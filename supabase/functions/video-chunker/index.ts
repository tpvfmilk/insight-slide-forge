
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Define constants for server-side chunking
const MAX_CHUNK_SIZE_MB = 20; // Updated to match client-side settings
const MIN_CHUNK_DURATION = 30; // Minimum 30 seconds per chunk
const MAX_CHUNK_DURATION = 300; // Maximum 5 minutes per chunk

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
}

const supabase = createClient(
  supabaseUrl || "", 
  supabaseServiceKey || ""
);

// This function handles video chunking by creating virtual chunk references
// In a production environment with FFmpeg, this would create actual video chunks
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Video-chunker function called");
    const functionStartTime = Date.now();
    
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ 
          error: "Invalid JSON in request body",
          code: "INVALID_REQUEST"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { 
      projectId, 
      originalVideoPath,
      chunkingMetadata
    } = requestBody;

    if (!projectId) {
      return new Response(
        JSON.stringify({ 
          error: "Project ID is required",
          code: "MISSING_PROJECT_ID"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!originalVideoPath) {
      return new Response(
        JSON.stringify({ 
          error: "Original video path is required",
          code: "MISSING_VIDEO_PATH"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!chunkingMetadata) {
      return new Response(
        JSON.stringify({ 
          error: "Chunking metadata is required",
          code: "MISSING_METADATA"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing chunking request for project ${projectId}`);
    console.log(`Original video path: ${originalVideoPath}`);
    console.log(`Chunking metadata has ${chunkingMetadata.chunks?.length || 0} chunks`);

    // Get project details to verify
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, title, source_file_path, video_metadata')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ 
          error: `Project not found: ${projectError.message}`,
          code: "PROJECT_NOT_FOUND"
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project) {
      return new Response(
        JSON.stringify({ 
          error: "Project not found in database",
          code: "PROJECT_NOT_FOUND"
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse the original video path to get bucket and file path
    const originalFilePath = project.source_file_path;
    if (!originalFilePath) {
      return new Response(
        JSON.stringify({ 
          error: "Project source file path not found",
          code: "MISSING_SOURCE_PATH"
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract info from original video path
    const pathParts = originalFilePath.split('/');
    let bucketName = 'video_uploads'; // Default bucket
    let originalFileName = pathParts[pathParts.length - 1];
    
    // Check if path includes the bucket name
    if (pathParts.length > 1 && pathParts[0] === 'video_uploads') {
      originalFileName = pathParts[pathParts.length - 1];
    }
    
    // Get the file extension from the original path
    const fileExtension = originalFileName.split('.').pop() || 'mp4';
    
    // In a real implementation with FFmpeg, we would:
    // 1. Download the original video
    // 2. Use FFmpeg to split it into chunks based on the timestamps
    // 3. Upload each chunk to storage
    
    // For this implementation, we'll:
    // 1. Create chunk metadata references without actually copying the file
    // 2. Update the project with simulated chunk information
    
    // Create chunks directory path
    const projectTitle = project.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const chunksBasePath = `${projectId}/${projectTitle}`;
    
    // Skip the actual file copy since we're hitting size limits
    // Instead of trying to copy the file, let's just log that we'd do it in a real implementation
    console.log(`In a production environment, would copy file to chunks/${chunksBasePath}/original.${fileExtension}`);
    console.log(`File size exceeds direct upload capabilities in edge function`);
    
    // Calculate appropriate chunk duration based on video metadata
    const videoDuration = chunkingMetadata.totalDuration || 0;
    const videoFileSize = project.video_metadata?.file_size || 0;
    
    // Calculate bytes per second (approximate) to better determine chunk sizes
    const bytesPerSecond = videoFileSize > 0 && videoDuration > 0 
      ? videoFileSize / videoDuration 
      : 500 * 1024; // Fallback to 500KB/s if we can't calculate
    
    // Calculate ideal chunk duration to stay under MAX_CHUNK_SIZE_MB
    const maxChunkSizeBytes = MAX_CHUNK_SIZE_MB * 1024 * 1024;
    let idealChunkDuration = Math.floor(maxChunkSizeBytes / bytesPerSecond);
    
    // Ensure chunk duration is between MIN and MAX thresholds
    idealChunkDuration = Math.min(MAX_CHUNK_DURATION, Math.max(MIN_CHUNK_DURATION, idealChunkDuration));
    
    console.log(`Video duration: ${videoDuration}s, size: ${(videoFileSize / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`Calculated bytes per second: ${(bytesPerSecond / 1024).toFixed(2)}KB/s`);
    console.log(`Ideal chunk duration: ${idealChunkDuration}s to stay under ${MAX_CHUNK_SIZE_MB}MB`);
    
    // Generate chunks metadata with appropriately sized segments
    const updatedChunks = [];
    let chunkStartTime = 0;
    let chunkIndex = 0;
    
    while (chunkStartTime < videoDuration) {
      // For the last chunk, make sure we don't exceed the total duration
      const chunkDuration = Math.min(idealChunkDuration, videoDuration - chunkStartTime);
      if (chunkDuration <= 0) break;
      
      const endTime = chunkStartTime + chunkDuration;
      
      // Generate the chunk file path - in production this would be a separate file
      // For now, we'll reference the original file with time ranges
      const chunkFileName = `${chunksBasePath}/${projectTitle}_chunk_${chunkIndex + 1}.${fileExtension}`;
      
      // Reference the original file path since we can't actually chunk the file in this implementation
      // In a real production environment, this would be a separate file
      // We're setting the path to use the original video reference with virtual chunking
      const chunkPath = originalFilePath;  // Reference original video path
      
      console.log(`Creating reference for chunk ${chunkIndex + 1}`);
      console.log(`Chunk duration: ${chunkDuration}s (${chunkStartTime}s - ${endTime}s)`);
      
      // Add chunk metadata with time ranges
      updatedChunks.push({
        index: chunkIndex,
        startTime: chunkStartTime,
        endTime: endTime,
        duration: chunkDuration,
        videoPath: chunkPath, // Use the original video path
        status: 'complete',
        title: `Chunk ${chunkIndex + 1}`,
        isVirtualChunk: true, // Flag to indicate this is a virtual chunk (not a separate file)
        originalVideoPath: originalFilePath // Keep the original path for reference
      });
      
      chunkStartTime = endTime;
      chunkIndex++;
    }
    
    // Update project with chunk info
    try {
      const updatedMetadata = {
        ...project.video_metadata,
        chunking: {
          ...chunkingMetadata,
          chunks: updatedChunks,
          isChunked: true,
          status: 'complete',
          isVirtualChunking: true, // Flag to indicate these are virtual chunks
          processedAt: new Date().toISOString()
        }
      };
      
      // Update the project in the database
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          video_metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
        
      if (updateError) {
        console.error("Failed to update project with chunk paths:", updateError);
        return new Response(
          JSON.stringify({ 
            error: `Failed to update project with chunk paths: ${updateError.message}`,
            code: "DB_UPDATE_ERROR"
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const totalTime = Date.now() - functionStartTime;
      console.log(`Video-chunker function completed in ${totalTime/1000} seconds`);
      
      // Return the updated chunk metadata
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Video chunks processed successfully",
          processingTime: totalTime/1000,
          chunks: updatedChunks,
          count: updatedChunks.length,
          virtualChunking: true // Indicate we're using virtual chunking
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (updateError: any) {
      console.error("Error during database update:", updateError);
      return new Response(
        JSON.stringify({ 
          error: `Database update error: ${updateError instanceof Error ? updateError.message : "Unknown error"}`,
          code: "DB_UPDATE_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error("Error in video-chunker function:", error);
    return new Response(
      JSON.stringify({ 
        error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
        code: "UNEXPECTED_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
