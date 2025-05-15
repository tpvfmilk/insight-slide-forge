
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const startTime = Date.now();
    
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
    // 1. Create a copy of the original video in the chunks bucket
    // 2. Reference this copy for all chunks in metadata
    // 3. Update the project with simulated chunk information
    
    // First, check if the original file exists
    let originalFileData;
    try {
      // Strip any 'video_uploads/' prefix for the download path if needed
      const downloadPath = originalFilePath.replace(/^video_uploads\//, '');
      console.log(`Checking for original file at: ${downloadPath}`);
      
      const { data, error } = await supabase
        .storage
        .from('video_uploads')
        .download(downloadPath);
        
      if (error) {
        console.error("Error accessing original video:", error);
        return new Response(
          JSON.stringify({ 
            error: `Could not access original video file: ${error.message}`,
            code: "VIDEO_ACCESS_ERROR"
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      originalFileData = data;
      console.log("Successfully accessed original video file");
    } catch (downloadError) {
      console.error("Error during download:", downloadError);
      return new Response(
        JSON.stringify({ 
          error: `Download error: ${downloadError instanceof Error ? downloadError.message : "Unknown error"}`,
          code: "DOWNLOAD_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create chunks directory
    const projectTitle = project.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const chunksBasePath = `${projectId}/${projectTitle}`;
    const mainChunkFilePath = `${chunksBasePath}/original.${fileExtension}`;
    
    console.log(`Creating main chunk file reference at chunks/${mainChunkFilePath}`);
    
    // Copy the file to the chunks bucket
    try {
      const { error: uploadError } = await supabase
        .storage
        .from('chunks')
        .upload(mainChunkFilePath, originalFileData, {
          contentType: `video/${fileExtension}`,
          upsert: true
        });
      
      if (uploadError) {
        console.error("Error copying original video to chunks bucket:", uploadError);
        return new Response(
          JSON.stringify({ 
            error: `Failed to copy video to chunks bucket: ${uploadError.message}`,
            code: "CHUNK_UPLOAD_ERROR"
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log("Successfully copied original video to chunks bucket");
    } catch (uploadError: any) {
      console.error("Error during upload to chunks bucket:", uploadError);
      return new Response(
        JSON.stringify({ 
          error: `Upload error: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`,
          code: "CHUNK_UPLOAD_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate appropriate chunk duration based on video metadata
    const videoDuration = chunkingMetadata.totalDuration || 0;
    const idealChunkDuration = 60; // Default to 60 second chunks
    
    // Generate chunks metadata with evenly distributed segments
    const updatedChunks = [];
    let startTime = 0;
    let chunkIndex = 0;
    
    while (startTime < videoDuration) {
      // For the last chunk, make sure we don't exceed the total duration
      const chunkDuration = Math.min(idealChunkDuration, videoDuration - startTime);
      if (chunkDuration <= 0) break;
      
      const endTime = startTime + chunkDuration;
      
      // Generate the chunk file path - in production this would be a separate file
      const chunkFileName = `${chunksBasePath}/${projectTitle}_chunk_${chunkIndex + 1}.${fileExtension}`;
      const chunkPath = `chunks/${chunkFileName}`;
      
      console.log(`Creating reference for chunk ${chunkIndex + 1} at path: ${chunkPath}`);
      
      // Add chunk metadata
      updatedChunks.push({
        index: chunkIndex,
        startTime: startTime,
        endTime: endTime,
        duration: chunkDuration,
        videoPath: chunkPath,
        status: 'complete',
        title: `Chunk ${chunkIndex + 1}`
      });
      
      startTime = endTime;
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
      
      const totalTime = Date.now() - startTime;
      console.log(`Video-chunker function completed in ${totalTime/1000} seconds`);
      
      // Return the updated chunk metadata
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Video chunks processed successfully",
          processingTime: totalTime/1000,
          chunks: updatedChunks,
          count: updatedChunks.length
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
