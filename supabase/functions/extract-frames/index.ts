
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { decode as base64Decode } from "https://deno.land/std@0.186.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define which ffmpeg command will be used to extract frames
async function extractFrameWithFFmpeg(
  videoBuffer: Uint8Array,
  timestamp: string,
  outputFilename: string,
  quality: number = 2 // Quality between 1-5 (1 best, 5 worst)
): Promise<Uint8Array | null> {
  try {
    // Create a command to extract a single frame at the given timestamp
    const ffmpegCommand = [
      "ffmpeg",
      "-i", "pipe:0",            // Input from stdin
      "-ss", timestamp,          // Seek to timestamp
      "-frames:v", "1",          // Extract single frame
      "-q:v", quality.toString(), // Quality setting
      "-f", "image2",            // Output format
      "-c:v", "mjpeg",           // Output codec
      "pipe:1"                   // Output to stdout
    ];

    // Setup the ffmpeg process
    const ffmpegProcess = Deno.run({
      cmd: ffmpegCommand,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped"
    });

    // Write the video buffer to stdin
    await ffmpegProcess.stdin.write(videoBuffer);
    ffmpegProcess.stdin.close();

    // Get the frame data from stdout
    const outputData = await ffmpegProcess.output();
    const status = await ffmpegProcess.status();
    ffmpegProcess.close();

    if (!status.success) {
      const stderr = new TextDecoder().decode(await ffmpegProcess.stderrOutput());
      console.error(`FFmpeg error: ${stderr}`);
      return null;
    }

    return outputData;
  } catch (error) {
    console.error("Error in FFmpeg process:", error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, timestamps, videoPath } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "Project ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!timestamps || !Array.isArray(timestamps) || timestamps.length === 0) {
      return new Response(
        JSON.stringify({ error: "Valid timestamps array is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!videoPath) {
      return new Response(
        JSON.stringify({ error: "Video path is required" }),
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

    // Download the video file from storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('video_uploads')
      .download(videoPath);
    
    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Failed to download video file", details: fileError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert the blob to an array buffer that ffmpeg can work with
    const arrayBuffer = await fileData.arrayBuffer();
    const videoBuffer = new Uint8Array(arrayBuffer);

    // Process each timestamp and extract frames
    const frameResults = [];
    const slides = [...(project.slides || [])];
    
    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      
      // Skip if timestamp is invalid
      if (!timestamp || typeof timestamp !== 'string') {
        continue;
      }

      // Extract the frame
      console.log(`Extracting frame at ${timestamp}`);
      const frameData = await extractFrameWithFFmpeg(videoBuffer, timestamp, `frame-${i}.jpg`);
      
      if (!frameData) {
        console.error(`Failed to extract frame at ${timestamp}`);
        continue;
      }

      // Upload the frame to storage
      const frameFileName = `${projectId}/${timestamp.replace(/:/g, '_')}.jpg`;
      const { error: uploadError, data: uploadData } = await supabase
        .storage
        .from('slide_images')
        .upload(frameFileName, frameData, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error(`Failed to upload frame: ${uploadError.message}`);
        continue;
      }

      // Get public URL for the uploaded frame
      const { data: urlData } = supabase
        .storage
        .from('slide_images')
        .getPublicUrl(frameFileName);

      // Find the corresponding slide and update its imageUrl
      const slideIndex = slides.findIndex(slide => slide.timestamp === timestamp);
      if (slideIndex >= 0) {
        slides[slideIndex] = {
          ...slides[slideIndex],
          imageUrl: urlData.publicUrl
        };
      }

      frameResults.push({
        timestamp,
        imageUrl: urlData.publicUrl
      });
    }

    // Update the project with the updated slides
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        slides,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to update project with frame images", 
          details: updateError.message,
          frames: frameResults // Still return the frames that were processed
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, frames: frameResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in extract-frames function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
