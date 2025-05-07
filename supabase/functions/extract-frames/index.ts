
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
    console.log(`Starting frame extraction for timestamp: ${timestamp}`);
    
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

    console.log(`Running FFmpeg command: ${ffmpegCommand.join(' ')}`);

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
    const stderrOutput = await ffmpegProcess.stderrOutput();
    const status = await ffmpegProcess.status();
    
    ffmpegProcess.close();

    if (!status.success) {
      const stderr = new TextDecoder().decode(stderrOutput);
      console.error(`FFmpeg error for timestamp ${timestamp}: ${stderr}`);
      return null;
    }

    console.log(`Successfully extracted frame for timestamp ${timestamp}, output size: ${outputData.length} bytes`);
    return outputData;
  } catch (error) {
    console.error(`Error in FFmpeg process for timestamp ${timestamp}:`, error);
    return null;
  }
}

// Function to ensure the slide_images bucket exists
async function ensureSlideImagesBucketExists(): Promise<boolean> {
  try {
    console.log("Checking if slide_images bucket exists");
    
    // Try to get the bucket
    const { data: bucket, error: getBucketError } = await supabase
      .storage
      .getBucket('slide_images');
      
    if (getBucketError) {
      if (getBucketError.message === 'The resource was not found') {
        console.log("slide_images bucket doesn't exist, creating it now");
        
        // Create the bucket
        const { error: createError } = await supabase
          .storage
          .createBucket('slide_images', {
            public: true,
            fileSizeLimit: 5242880 // 5MB
          });
          
        if (createError) {
          console.error("Error creating slide_images bucket:", createError);
          return false;
        } else {
          console.log("Created slide_images bucket successfully");
          return true;
        }
      } else {
        console.error("Error checking slide_images bucket:", getBucketError);
        return false;
      }
    } else {
      console.log("slide_images bucket already exists");
      
      // Ensure the bucket is public
      const { error: updateError } = await supabase
        .storage
        .updateBucket('slide_images', {
          public: true,
          fileSizeLimit: 5242880 // 5MB
        });
        
      if (updateError) {
        console.error("Error updating slide_images bucket:", updateError);
      } else {
        console.log("Updated slide_images bucket to ensure it's public");
      }
      
      return true;
    }
  } catch (bucketError) {
    console.error("Exception checking/creating slide_images bucket:", bucketError);
    return false;
  }
}

serve(async (req) => {
  console.log("Extract-frames function called");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, timestamps, videoPath } = await req.json();
    console.log(`Request received with projectId: ${projectId}, timestamps count: ${timestamps?.length}, videoPath: ${videoPath}`);

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
    console.log(`Fetching project with ID: ${projectId}`);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error("Project fetch error:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found", details: projectError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure slide_images bucket exists
    const bucketExists = await ensureSlideImagesBucketExists();
    if (!bucketExists) {
      console.warn("Could not verify slide_images bucket, will attempt to continue anyway");
    }

    // Download the video file from storage
    console.log(`Downloading video from path: ${videoPath}`);
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('video_uploads')
      .download(videoPath);
    
    if (fileError || !fileData) {
      console.error("Video download error:", fileError);
      return new Response(
        JSON.stringify({ error: "Failed to download video file", details: fileError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Video downloaded successfully, size: ${fileData.size} bytes`);

    // Convert the blob to an array buffer that ffmpeg can work with
    const arrayBuffer = await fileData.arrayBuffer();
    const videoBuffer = new Uint8Array(arrayBuffer);

    // Process each timestamp and extract frames
    const frameResults = [];
    const slides = [...(project.slides || [])];
    
    // Deduplicate timestamps to avoid extracting the same frame multiple times
    const uniqueTimestamps = [...new Set(timestamps)];
    console.log(`Processing ${uniqueTimestamps.length} unique timestamps out of ${timestamps.length} total`);
    
    for (let i = 0; i < uniqueTimestamps.length; i++) {
      const timestamp = uniqueTimestamps[i];
      
      // Skip if timestamp is invalid
      if (!timestamp || typeof timestamp !== 'string') {
        console.warn(`Skipping invalid timestamp at index ${i}`);
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
      console.log(`Uploading frame to: slide_images/${frameFileName}`);
      
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

      console.log(`Frame uploaded successfully: ${frameFileName}`);

      // Get public URL for the uploaded frame
      const { data: urlData } = supabase
        .storage
        .from('slide_images')
        .getPublicUrl(frameFileName);

      console.log(`Public URL generated: ${urlData.publicUrl}`);

      frameResults.push({
        timestamp,
        imageUrl: urlData.publicUrl
      });
    }

    console.log(`Processed ${frameResults.length} frames successfully`);

    // Update slides with new image URLs (handle both the old and new format)
    const updatedSlides = slides.map(slide => {
      // For slides with transcriptTimestamps array
      if (slide.transcriptTimestamps && Array.isArray(slide.transcriptTimestamps)) {
        const matchingFrames = frameResults.filter(frame => 
          slide.transcriptTimestamps.includes(frame.timestamp)
        );

        if (matchingFrames.length > 0) {
          console.log(`Slide ${slide.id}: Found ${matchingFrames.length} matching frames`);
          return {
            ...slide,
            imageUrls: matchingFrames.map(frame => frame.imageUrl)
          };
        }
      } 
      // For slides with single timestamp (backward compatibility)
      else if (slide.timestamp) {
        const matchingFrame = frameResults.find(frame => frame.timestamp === slide.timestamp);
        if (matchingFrame) {
          console.log(`Slide ${slide.id}: Found matching frame for timestamp ${slide.timestamp}`);
          return {
            ...slide,
            imageUrl: matchingFrame.imageUrl
          };
        }
      }
      
      // If no matches, return slide as is
      return slide;
    });

    // Update the project with the updated slides
    console.log(`Updating project ${projectId} with ${updatedSlides.length} slides containing images`);
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        slides: updatedSlides,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      console.error("Project update error:", updateError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to update project with frame images", 
          details: updateError.message,
          frames: frameResults // Still return the frames that were processed
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Extract-frames function completed successfully");
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
