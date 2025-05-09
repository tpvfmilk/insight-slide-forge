
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
    console.log("Transcribe-video function called");
    const startTime = Date.now();
    
    const { projectId, audioData, useSpeakerDetection = false, isTranscriptOnly = false } = await req.json();

    console.log(`Processing request: projectId=${projectId}, useSpeakerDetection=${useSpeakerDetection}, isTranscriptOnly=${isTranscriptOnly}`);
    console.log(`Has audioData: ${Boolean(audioData)}, audioData length: ${audioData ? audioData.length : 0}`);

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
      console.log(`Processing directly provided audio data (${(audioData.length / 1024 / 1024).toFixed(2)}MB base64)`);
      
      try {
        // Process audio data in chunks to avoid memory issues
        const chunkSize = 1024 * 1024; // 1MB chunks
        const totalChunks = Math.ceil(audioData.length / chunkSize);
        
        console.log(`Processing audio in ${totalChunks} chunks`);
        
        const bytes = new Uint8Array(audioData.length);
        
        // Process chunks
        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, audioData.length);
          const chunk = audioData.substring(start, end);
          
          // Decode the base64 chunk
          const binaryChunk = atob(chunk);
          for (let j = 0; j < binaryChunk.length; j++) {
            bytes[start + j] = binaryChunk.charCodeAt(j);
          }
          
          console.log(`Processed chunk ${i + 1}/${totalChunks}`);
        }
        
        audioBlob = new Blob([bytes], { type: 'audio/mp3' });
        console.log(`Audio blob created, size: ${audioBlob.size / 1024 / 1024} MB`);
      } catch (e) {
        console.error("Error decoding audio data:", e);
        return new Response(
          JSON.stringify({ error: "Failed to decode audio data", details: e.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } 
    // Handle project with video file stored in Supabase
    else {
      console.log("Processing project with ID:", projectId);
      
      // Get project details from database
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError || !projectData) {
        console.error("Project not found:", projectError);
        return new Response(
          JSON.stringify({ error: "Project not found", details: projectError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      project = projectData;

      // Check if we have a source file to transcribe
      if (project.source_type !== 'video' && project.source_type !== 'transcript-only' || !project.source_file_path) {
        console.error("No video file available for transcription");
        return new Response(
          JSON.stringify({ error: "No video file available for transcription" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Download the video file from storage
      console.log("Downloading video file from storage:", project.source_file_path);
      const { data: videoData, error: fileError } = await supabase
        .storage
        .from('video_uploads')
        .download(project.source_file_path);
      
      if (fileError || !videoData) {
        console.error("Failed to download video file:", fileError);
        return new Response(
          JSON.stringify({ error: "Failed to download video file", details: fileError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      fileData = videoData;
      console.log("Video file downloaded successfully");
    }

    // Create form data for OpenAI API
    const formData = new FormData();
    
    // Use the appropriate data source
    if (audioBlob) {
      console.log("Using audio blob from provided audio data");
      formData.append('file', audioBlob, 'audio.mp3');
    } else if (fileData) {
      console.log("Using video file from storage");
      formData.append('file', fileData, 'audio.mp4');
    }
    
    // Configure the transcription options
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Default to English
    
    // For speaker detection, we use the response_format 'verbose_json'
    if (useSpeakerDetection) {
      console.log("Enabling speaker detection with verbose_json format");
      formData.append('response_format', 'verbose_json');
    }
    
    // Call OpenAI's Whisper API for transcription
    console.log("Calling OpenAI Whisper API for transcription");
    
    const whisperStart = Date.now();
    let openAIError = null;
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API timeout after 20 seconds")), 40000);
    });
    
    // Make the API call with timeout
    const apiCallPromise = fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: formData
    });
    
    // Use Promise.race to implement timeout
    let openAIResponse;
    try {
      openAIResponse = await Promise.race([apiCallPromise, timeoutPromise]) as Response;
    } catch (e) {
      console.error("OpenAI API call failed with timeout:", e);
      openAIError = e;
    }

    if (!openAIResponse || !openAIResponse.ok) {
      const errorMessage = openAIError ? openAIError.message : "Unknown OpenAI API error";
      let errorDetails = "Unknown error";
      
      if (openAIResponse) {
        try {
          const errorData = await openAIResponse.json();
          errorDetails = errorData.error?.message || "Unknown API error";
        } catch (e) {
          errorDetails = "Could not parse error response";
        }
      }
      
      console.error(`OpenAI transcription failed: ${errorDetails}`);
      
      // If there's a project, update it with the error
      if (projectId) {
        await supabase
          .from('projects')
          .update({
            updated_at: new Date().toISOString(),
            transcript: `[Transcription failed: ${errorDetails}]`
          })
          .eq('id', projectId);
      }
      
      return new Response(
        JSON.stringify({ 
          error: "OpenAI transcription failed", 
          details: errorDetails 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whisperEnd = Date.now();
    console.log(`OpenAI API responded in ${(whisperEnd - whisperStart) / 1000} seconds`);

    // Process the transcription data
    console.log("Processing transcription data");
    const transcriptionData = await openAIResponse.json();
    let transcript;
    
    // Format the transcript with speaker detection if requested
    if (useSpeakerDetection && transcriptionData.segments) {
      transcript = formatTranscriptWithSpeakers(transcriptionData);
    } else {
      transcript = transcriptionData.text;
    }

    console.log(`Transcript generated (${transcript.length} chars)`);

    // For direct audio processing (transcript-only mode)
    if (audioData && !projectId) {
      console.log("Returning transcript without storing");
      return new Response(
        JSON.stringify({ success: true, transcript }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get project user_id for tracking usage (Fix for the "Cannot read properties of undefined (reading 'user_id')" error)
    let userId;
    if (project) {
      userId = project.user_id;
    } else {
      // If we don't have a project object, try to fetch the project's user_id directly
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single();

      if (projectError || !projectData) {
        console.error("Could not get user_id for project:", projectError);
        userId = null;
      } else {
        userId = projectData.user_id;
      }
    }

    // Track the token usage for transcriptions if we have a user_id
    if (userId) {
      // For Whisper API, we estimate based on audio duration (since the API doesn't return token counts)
      const audioMinutes = project?.video_metadata?.duration 
        ? Math.ceil(project.video_metadata.duration / 60)
        : 5; // Default estimate, in a real app you'd calculate this from the audio length
      const estimatedTokens = audioMinutes * 1000;
      const estimatedCost = audioMinutes * 0.006; // $0.006 per minute for whisper-1

      // Insert usage data into openai_usage table
      console.log("Recording usage data");
      const { error: usageError } = await supabase
        .from('openai_usage')
        .insert({
          user_id: userId,
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
    }

    // Update the project with the transcript
    console.log("Updating project with transcript");
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        transcript: transcript,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      console.error("Failed to update project with transcript:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update project with transcript", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this is a transcript-only project and we should delete the source file
    if (isTranscriptOnly && project && project.source_file_path) {
      try {
        console.log(`Deleting source file ${project.source_file_path} for transcript-only project`);
        await supabase.storage.from('video_uploads').remove([project.source_file_path]);
        
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

    const totalTime = Date.now() - startTime;
    console.log(`Transcribe-video function completed in ${totalTime/1000} seconds`);

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
