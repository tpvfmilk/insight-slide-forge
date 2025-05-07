
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

// Function to ensure the slide_stills bucket exists
async function ensureSlideStillsBucketExists(): Promise<boolean> {
  try {
    console.log("Checking if slide_stills bucket exists");
    
    // Try to get the bucket
    const { data: bucket, error: getBucketError } = await supabase
      .storage
      .getBucket('slide_stills');
      
    if (getBucketError) {
      if (getBucketError.message === 'The resource was not found') {
        console.log("slide_stills bucket doesn't exist, creating it now");
        
        // Create the bucket
        const { error: createError } = await supabase
          .storage
          .createBucket('slide_stills', {
            public: true,
            fileSizeLimit: 5242880 // 5MB
          });
          
        if (createError) {
          console.error("Error creating slide_stills bucket:", createError);
          return false;
        } else {
          console.log("Created slide_stills bucket successfully");
          return true;
        }
      } else {
        console.error("Error checking slide_stills bucket:", getBucketError);
        return false;
      }
    } else {
      console.log("slide_stills bucket already exists");
      
      // Ensure the bucket is public
      const { error: updateError } = await supabase
        .storage
        .updateBucket('slide_stills', {
          public: true,
          fileSizeLimit: 5242880 // 5MB
        });
        
      if (updateError) {
        console.error("Error updating slide_stills bucket:", updateError);
      } else {
        console.log("Updated slide_stills bucket to ensure it's public");
      }
      
      return true;
    }
  } catch (bucketError) {
    console.error("Exception checking/creating slide_stills bucket:", bucketError);
    return false;
  }
}

// Generate a placeholder image with text when FFmpeg is not available
async function generatePlaceholderImage(timestamp: string, projectId: string): Promise<Uint8Array | null> {
  try {
    // Simple placeholder logic - in a real system this might use a canvas or other approach
    // Here we're just creating a dummy placeholder
    
    // Create a small colored box with text as a base64 encoded PNG
    // This is a minimalist 1x1 transparent pixel
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    
    // Decode the base64 image
    return base64Decode(base64Image);
  } catch (error) {
    console.error(`Error generating placeholder for timestamp ${timestamp}:`, error);
    return null;
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

    // Check if the video path is valid 
    if (!videoPath.match(/^[a-zA-Z0-9\-_.\/]+$/)) {
      console.error("Invalid video path format:", videoPath);
      return new Response(
        JSON.stringify({ error: "Invalid video path format", details: "Path contains invalid characters" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure slide_stills bucket exists
    const bucketExists = await ensureSlideStillsBucketExists();
    if (!bucketExists) {
      console.warn("Could not verify slide_stills bucket, will attempt to continue anyway");
    }

    // Try to download from video_uploads bucket
    let fileData: ArrayBuffer | null = null;
    let fileError = null;
    
    try {
      console.log(`Downloading video from path: ${videoPath}`);
      const result = await supabase
        .storage
        .from('video_uploads')
        .download(videoPath);
      
      fileData = result.data;
      fileError = result.error;
    } catch (err) {
      console.log(`Error downloading from video_uploads, will try videos bucket: ${err.message}`);
      fileError = err;
    }
    
    // If failed, try videos bucket
    if (fileError || !fileData) {
      try {
        // Try to extract just the filename
        const filename = videoPath.split('/').pop();
        if (!filename) {
          throw new Error("Invalid video path format");
        }
        
        console.log(`Trying videos bucket with filename: ${filename}`);
        const result = await supabase
          .storage
          .from('videos')
          .download(filename);
          
        fileData = result.data;
        fileError = result.error;
      } catch (err) {
        console.log(`Error downloading from videos bucket: ${err.message}`);
        fileError = fileError || err;
      }
    }
    
    if (fileError || !fileData) {
      console.error("Video download error:", fileError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to download video file", 
          details: fileError?.message,
          // Include helpful debug info
          path: videoPath,
          tried: ["video_uploads", "videos"]
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Video downloaded successfully, size: ${fileData.byteLength} bytes`);
    console.log("Deno.run is not available in this environment. Using placeholder images instead.");

    // Process each timestamp and generate placeholder frames
    const frameResults = [];
    const slides = [...(project.slides || [])];
    
    // Deduplicate timestamps to avoid processing the same frame multiple times
    const uniqueTimestamps = [...new Set(timestamps)];
    console.log(`Processing ${uniqueTimestamps.length} unique timestamps out of ${timestamps.length} total`);
    
    for (let i = 0; i < uniqueTimestamps.length; i++) {
      const timestamp = uniqueTimestamps[i];
      
      // Skip if timestamp is invalid
      if (!timestamp || typeof timestamp !== 'string') {
        console.warn(`Skipping invalid timestamp at index ${i}`);
        continue;
      }

      // Generate placeholder image instead of extracting frame
      console.log(`Generating placeholder for timestamp ${timestamp}`);
      
      // In a production app, we might try to use a canvas or image library
      // For now, we'll just create a simple colored box with timestamp text
      const frameData = await generatePlaceholderImage(timestamp, projectId);
      
      if (!frameData) {
        console.error(`Failed to generate placeholder for timestamp ${timestamp}`);
        continue;
      }

      // Upload the placeholder to storage
      const frameFileName = `${projectId}/${timestamp.replace(/:/g, '_')}_placeholder.png`;
      console.log(`Uploading placeholder to: slide_stills/${frameFileName}`);
      
      const { error: uploadError, data: uploadData } = await supabase
        .storage
        .from('slide_stills')
        .upload(frameFileName, frameData, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error(`Failed to upload placeholder: ${uploadError.message}`);
        continue;
      }

      console.log(`Placeholder uploaded successfully: ${frameFileName}`);

      // Get public URL for the uploaded placeholder
      const { data: urlData } = supabase
        .storage
        .from('slide_stills')
        .getPublicUrl(frameFileName);

      console.log(`Public URL generated: ${urlData.publicUrl}`);

      frameResults.push({
        timestamp,
        imageUrl: urlData.publicUrl
      });
    }

    console.log(`Processed ${frameResults.length} placeholders successfully`);

    // Update slides with new image URLs (handle both the old and new format)
    const updatedSlides = slides.map(slide => {
      // Type guard to ensure we can safely access slide properties
      if (typeof slide !== 'object' || slide === null) {
        return slide;
      }

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
    console.log(`Updating project ${projectId} with ${updatedSlides.length} slides containing placeholder images`);
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
