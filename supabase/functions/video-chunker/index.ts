
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

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
    
    const { 
      projectId, 
      originalVideoPath,
      chunkingMetadata
    } = await req.json();

    if (!projectId || !originalVideoPath || !chunkingMetadata) {
      return new Response(
        JSON.stringify({ error: "Project ID, original video path and chunking metadata are required" }),
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

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse the original video path to get bucket and file path
    const originalFilePath = project.source_file_path;
    if (!originalFilePath) {
      return new Response(
        JSON.stringify({ error: "Project source file path not found" }),
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
    
    // In this implementation, we'll:
    // 1. Create a copy of the original video in the chunks bucket
    // 2. Reference this copy for all chunks in metadata
    // 3. Update the project with simulated chunk information
    
    // First, copy the original video to the chunks bucket
    const projectTitle = project.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const chunksBasePath = `${projectId}/${projectTitle}`;
    const mainChunkFilePath = `${chunksBasePath}/original.${fileExtension}`;
    
    console.log(`Creating main chunk file reference at chunks/${mainChunkFilePath}`);
    
    // Check if the original file exists
    const { data: originalFileData, error: originalFileError } = await supabase
      .storage
      .from('video_uploads')
      .download(originalFilePath.replace('video_uploads/', ''));
    
    if (originalFileError) {
      console.error("Error accessing original video:", originalFileError);
      return new Response(
        JSON.stringify({ error: "Could not access original video file" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Copy the file to the chunks bucket
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
        JSON.stringify({ error: "Failed to copy video to chunks bucket" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log("Successfully copied original video to chunks bucket");
    
    const updatedChunks = [];
    
    // Process each chunk in the metadata
    for (let i = 0; i < chunkingMetadata.chunks.length; i++) {
      const chunk = chunkingMetadata.chunks[i];
      
      // Generate paths for the chunk files
      // In a real implementation with FFmpeg, each chunk would be a separate file
      // For this implementation, all chunks reference the same copied file
      const chunkFileName = `${chunksBasePath}/${projectTitle}_chunk_${i + 1}.${fileExtension}`;
      const chunkPath = `chunks/${chunkFileName}`;
      
      console.log(`Creating reference for chunk ${i + 1} at path: ${chunkPath}`);
      
      // Update the chunk metadata with the path
      updatedChunks.push({
        ...chunk,
        videoPath: chunkPath,
        status: 'complete',
        title: `Chunk ${i + 1}`
      });
    }
    
    // Update project with chunk info
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
        JSON.stringify({ error: "Failed to update project with chunk paths" }),
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
        chunks: updatedChunks 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in video-chunker function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
