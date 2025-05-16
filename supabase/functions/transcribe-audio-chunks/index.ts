
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

const supabase = createClient(
  supabaseUrl || "", 
  supabaseServiceKey || ""
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("Transcribe-audio-chunks function called");
    const startTime = Date.now();

    // Parse request body
    const { projectId, chunks } = await req.json();
    
    if (!projectId) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameter: projectId",
          success: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Missing or invalid chunks data",
          success: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${chunks.length} audio chunks for project ${projectId}`);
    
    // Check if we have the OpenAI API key
    if (!openAIApiKey) {
      console.error("OPENAI_API_KEY is not configured in edge function secrets");
      return new Response(
        JSON.stringify({
          error: "OpenAI API key not configured",
          success: false
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get project information - we'll need the title
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('title')
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error("Error fetching project:", projectError);
      
      return new Response(
        JSON.stringify({
          error: `Failed to fetch project: ${projectError.message}`,
          success: false
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const projectTitle = project?.title || "Untitled Project";
    
    // Process each chunk with Whisper API
    const processedChunks = [];
    const failedChunks = [];
    let combinedTranscript = "";
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.startTime.toFixed(1)}s - ${chunk.endTime.toFixed(1)}s`);
      
      try {
        if (!chunk.path) {
          throw new Error("Missing path in chunk metadata");
        }
        
        // Get the audio file from storage
        const { data: signedURLData, error: signedURLError } = await supabase
          .storage
          .from('audio_chunks')
          .createSignedUrl(chunk.path, 60); // 60 seconds expiry
        
        if (signedURLError || !signedURLData?.signedUrl) {
          throw new Error(`Failed to get signed URL: ${signedURLError?.message || "No URL returned"}`);
        }
        
        // Download the audio content
        const audioResponse = await fetch(signedURLData.signedUrl);
        
        if (!audioResponse.ok) {
          throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
        }
        
        const audioBlob = await audioResponse.blob();
        console.log(`Downloaded chunk ${i + 1}: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Check if the audio is too large for the Whisper API
        if (audioBlob.size > 25 * 1024 * 1024) { // 25MB limit
          throw new Error(`Audio chunk exceeds size limit: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);
        }
        
        // Create form data for the Whisper API
        const formData = new FormData();
        formData.append('file', audioBlob, `chunk_${i}.wav`);
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        formData.append('language', 'en');
        
        // Call the Whisper API
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`
          },
          body: formData
        });
        
        if (!whisperResponse.ok) {
          const errorText = await whisperResponse.text();
          throw new Error(`Whisper API error: ${whisperResponse.status} - ${errorText}`);
        }
        
        const whisperData = await whisperResponse.json();
        console.log(`Received transcription for chunk ${i + 1}, length: ${whisperData.text?.length || 0} chars`);
        
        // Format the chunk's transcript with timestamp info
        const formattedTime = (seconds: number) => {
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.floor(seconds % 60);
          return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        };
        
        // Add the chunk's transcript to the combined transcript
        const chunkHeader = `## ${projectTitle} - Part ${i + 1} (${formattedTime(chunk.startTime)} to ${formattedTime(chunk.endTime)})`;
        
        if (combinedTranscript) {
          combinedTranscript += `\n\n${chunkHeader}\n\n${whisperData.text}`;
        } else {
          combinedTranscript = `# ${projectTitle} Transcription\n\n${chunkHeader}\n\n${whisperData.text}`;
        }
        
        processedChunks.push({
          ...chunk,
          transcribed: true
        });
        
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
        
        // Note the failure in the transcript but continue processing
        const errorNote = `## ${projectTitle} - Part ${i + 1}\n\n[Error transcribing this segment: ${error.message}]`;
        
        if (combinedTranscript) {
          combinedTranscript += `\n\n${errorNote}`;
        } else {
          combinedTranscript = `# ${projectTitle} Transcription\n\n${errorNote}`;
        }
        
        failedChunks.push({
          ...chunk,
          error: error.message
        });
      }
    }
    
    // Update the project with the transcript
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        transcript: combinedTranscript,
        updated_at: new Date()
      })
      .eq('id', projectId);
      
    if (updateError) {
      console.error(`Error updating project: ${updateError.message}`);
    }
    
    // Calculate processing time
    const totalTime = Date.now() - startTime;
    console.log(`Processed ${processedChunks.length} chunks in ${totalTime/1000} seconds, with ${failedChunks.length} failures`);
    
    return new Response(
      JSON.stringify({
        success: true,
        transcript: combinedTranscript,
        processedCount: processedChunks.length,
        failedCount: failedChunks.length,
        processingTimeSeconds: totalTime/1000
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in transcribe-audio-chunks:", error);
    
    return new Response(
      JSON.stringify({
        error: `Transcription failed: ${error.message}`,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
