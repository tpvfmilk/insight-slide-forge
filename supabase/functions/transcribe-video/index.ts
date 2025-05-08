
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
    const { projectId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "Project ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get project details from database
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found", details: projectError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we have a source file to transcribe
    if (project.source_type !== 'video' || !project.source_file_path) {
      return new Response(
        JSON.stringify({ error: "No video file available for transcription" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Download the video file from storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('video_uploads')
      .download(project.source_file_path);
    
    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Failed to download video file", details: fileError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Extract audio from video and transcribe it with OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', fileData, 'audio.mp4');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Default to English
    
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

    const transcriptionData = await openAIResponse.json();
    const transcript = transcriptionData.text;

    // Track the token usage for transcriptions
    // For Whisper API, we estimate based on audio duration (since the API doesn't return token counts)
    // Assuming 1 minute of audio is roughly 800-1000 tokens
    const audioMinutes = 5; // Default estimate, in a real app you'd calculate this from the audio length
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

    // 3. Update the project with the transcript
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
