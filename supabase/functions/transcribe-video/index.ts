
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAIKey = Deno.env.get("OPENAI_API_KEY");
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, audioData, useSpeakerDetection = false, isTranscriptOnly = false } = await req.json();

    if (!projectId && !audioData) {
      return new Response(
        JSON.stringify({ error: "Project ID or audio data is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let project;
    let fileData;
    let audioBlob;

    // Handle direct audio data (from client-side extraction)
    if (audioData) {
      console.log("Processing directly provided audio data");
      
      // Decode the base64 audio data
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      audioBlob = new Blob([bytes], { type: 'audio/mp3' });
    } 
    // Handle project with video file stored in Supabase
    else {
      console.log("Processing project with ID:", projectId);
      
      // Get project details from database
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !projectData) {
        return new Response(
          JSON.stringify({ error: "Project not found", details: projectError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      project = projectData;

      // Check if we have a source file to transcribe
      if (project.source_type !== 'video' && project.source_type !== 'transcript-only' || !project.source_file_path) {
        return new Response(
          JSON.stringify({ error: "No video file available for transcription" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Download the video file from storage
      const { data: videoData, error: fileError } = await supabase
        .storage
        .from('video_uploads')
        .download(project.source_file_path);
      
      if (fileError || !videoData) {
        return new Response(
          JSON.stringify({ error: "Failed to download video file", details: fileError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      fileData = videoData;
    }

    // Create form data for OpenAI API
    const formData = new FormData();
    
    // Use the appropriate data source
    if (audioBlob) {
      formData.append('file', audioBlob, 'audio.mp3');
    } else if (fileData) {
      formData.append('file', fileData, 'audio.mp4');
    }
    
    // Configure the transcription options
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Default to English
    
    // For speaker detection, we use the response_format 'verbose_json'
    if (useSpeakerDetection) {
      formData.append('response_format', 'verbose_json');
    }
    
    // Call OpenAI's Whisper API for transcription
    const openAIResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: formData
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      return new Response(
        JSON.stringify({ 
          error: "OpenAI transcription failed", 
          details: errorData.error?.message || "Unknown error" 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process the transcription data
    const transcriptionData = await openAIResponse.json();
    let transcript;
    
    // Format the transcript with speaker detection if requested
    if (useSpeakerDetection && transcriptionData.segments) {
      transcript = formatTranscriptWithSpeakers(transcriptionData);
    } else {
      transcript = transcriptionData.text;
    }

    // For direct audio processing (transcript-only mode)
    if (audioData && !projectId) {
      // Return just the transcript without storing it
      return new Response(
        JSON.stringify({ success: true, transcript }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track the token usage for transcriptions
    // For Whisper API, we estimate based on audio duration (since the API doesn't return token counts)
    const audioMinutes = project?.video_metadata?.duration 
      ? Math.ceil(project.video_metadata.duration / 60)
      : 5; // Default estimate, in a real app you'd calculate this from the audio length
    const estimatedTokens = audioMinutes * 1000;
    const estimatedCost = audioMinutes * 0.006; // $0.006 per minute for whisper-1

    // Insert usage data into openai_usage table
    const { error: usageError } = await supabase
      .from('openai_usage')
      .insert({
        user_id: project.user_id,
        project_id: projectId,
        model_id: 'whisper-1',
        input_tokens: estimatedTokens,
        output_tokens: 0, // Whisper doesn't have output tokens in the same way
        total_tokens: estimatedTokens,
        estimated_cost: estimatedCost
      });

    if (usageError) {
      console.error("Error recording token usage:", usageError);
      // Continue with the function even if usage tracking fails
    }

    // Update the project with the transcript
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        transcript: transcript,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update project with transcript", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this is a transcript-only project and we should delete the source file
    if (isTranscriptOnly && project.source_file_path) {
      try {
        await supabase.storage.from('video_uploads').remove([project.source_file_path]);
        console.log(`Deleted source file ${project.source_file_path} for transcript-only project`);
        
        // Update project to reflect the file has been deleted
        await supabase
          .from('projects')
          .update({ 
            source_file_path: null,
          })
          .eq('id', projectId);
      } catch (deleteError) {
        console.error("Error deleting source file:", deleteError);
        // Continue regardless of file deletion success
      }
    }

    return new Response(
      JSON.stringify({ success: true, transcript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in transcribe-video function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Format the transcript with speaker detection and line breaks
 */
function formatTranscriptWithSpeakers(transcriptionData) {
  let formattedText = '';
  let currentSpeaker = null;
  
  if (!transcriptionData.segments || !Array.isArray(transcriptionData.segments)) {
    return transcriptionData.text;
  }
  
  for (const segment of transcriptionData.segments) {
    // Check if speaker has changed
    if (segment.speaker !== currentSpeaker) {
      formattedText += '\n\n';
      formattedText += `Speaker ${segment.speaker}: `;
      currentSpeaker = segment.speaker;
    }
    
    formattedText += segment.text;
  }
  
  return formattedText.trim();
}
