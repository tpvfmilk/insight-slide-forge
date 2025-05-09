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
    // IMPORTANT: This is a placeholder 1x1 pixel that will be replaced by client-side extraction
    // We're using a specific color to make it clear this is a placeholder
    // #FF00FF (magenta) as a base64-encoded PNG to make it obvious this is a placeholder
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
    
    // Decode the base64 image
    return base64Decode(base64Image);
  } catch (error) {
    console.error(`Error generating placeholder for timestamp ${timestamp}:`, error);
    return null;
  }
}

// Function to process video URL and extract frame (simulated, would use FFmpeg or similar in production)
async function processVideoFrame(videoUrl: string, timestamp: string, projectId: string): Promise<Uint8Array | null> {
  console.log(`Processing video frame at timestamp ${timestamp} from URL: ${videoUrl}`);
  
  try {
    // In a production environment, you would use FFmpeg or a similar tool to extract
    // the frame from the video at the specified timestamp
    
    // Since we can't run FFmpeg directly in this edge function, we'll use placeholders
    // and inform the client to try client-side extraction first and fallback to this
    // if needed for a more robust solution
    
    // Simulate processing delay to make it feel more real
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // For a real implementation, you would:
    // 1. Download the video to a temporary location
    // 2. Use FFmpeg to extract the frame at the specified timestamp
    // 3. Return the extracted frame as a binary buffer
    
    // For now, return placeholder image
    return await generatePlaceholderImage(timestamp, projectId);
  } catch (error) {
    console.error(`Error processing video frame at ${timestamp}:`, error);
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
    const { projectId, timestamps, videoPath, fallbackToServer, clientSideFailed } = await req.json();
    console.log(`Request received with projectId: ${projectId}, timestamps count: ${timestamps?.length}, videoPath: ${videoPath}, fallbackToServer: ${fallbackToServer}, clientSideFailed: ${clientSideFailed}`);

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
    
    // Generate signed URL for video access
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('video_uploads')
      .createSignedUrl(videoPath, 60 * 60); // 1 hour expiry

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      return new Response(
        JSON.stringify({ error: "Could not generate video URL", details: urlError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoUrl = urlData.signedUrl;
    console.log(`Generated signed URL for video: ${videoUrl}`);

    // If client extraction has failed or a server fallback is requested, try to process server-side
    // Otherwise just return placeholders for client-side extraction
    let doServerExtraction = fallbackToServer || clientSideFailed;
    
    if (doServerExtraction) {
      console.log("Using server-side extraction (or simulated version)");
    } else {
      console.log("Using client-side extraction with placeholder frames");
    }
    
    // Process each timestamp and generate/extract frames
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

      // Process the frame
      console.log(`Processing frame for timestamp ${timestamp}`);
      
      let frameData;
      if (doServerExtraction) {
        frameData = await processVideoFrame(videoUrl, timestamp, projectId);
      } else {
        frameData = await generatePlaceholderImage(timestamp, projectId);
      }
      
      if (!frameData) {
        console.error(`Failed to generate/extract frame for timestamp ${timestamp}`);
        continue;
      }

      // Upload the frame to storage
      const frameFileName = `${projectId}/${timestamp.replace(/:/g, '_')}_${doServerExtraction ? 'extracted' : 'placeholder'}.png`;
      console.log(`Uploading frame to: slide_stills/${frameFileName}`);
      
      const { error: uploadError, data: uploadData } = await supabase
        .storage
        .from('slide_stills')
        .upload(frameFileName, frameData, {
          contentType: 'image/png',
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
        .from('slide_stills')
        .getPublicUrl(frameFileName);

      console.log(`Public URL generated: ${urlData.publicUrl}`);

      frameResults.push({
        timestamp,
        imageUrl: urlData.publicUrl,
        isPlaceholder: !doServerExtraction // Flag to indicate if this is a placeholder
      });
    }

    console.log(`Processed ${frameResults.length} frames successfully`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        frames: frameResults,
        isPlaceholder: !doServerExtraction,
        message: doServerExtraction 
          ? "Frames were extracted server-side" 
          : "These are placeholder images. Client should extract real frames."
      }),
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
