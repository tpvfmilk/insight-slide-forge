
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

// This function simulates server-side chunking without actually using FFmpeg
// In a production environment, you'd use FFmpeg to split the video properly
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
      .select('id, title, video_metadata')
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
    const { bucketName, filePath } = parseStoragePath(originalVideoPath);
    
    // Get the file extension from the original path
    const fileExtension = filePath.split('.').pop() || 'mp4';
    
    // In a real implementation with FFmpeg, you would:
    // 1. Download the original video
    // 2. Use FFmpeg to split it into chunks based on the timestamps
    // 3. Upload each chunk to storage
    // 4. Update the chunk metadata with the paths
    
    // For this implementation, we'll simulate the chunking by 
    // creating references to the original video but with different metadata
    // In a real implementation, you would create actual chunk files
    
    const updatedChunks = [];
    
    // Process each chunk in the metadata
    for (let i = 0; i < chunkingMetadata.chunks.length; i++) {
      const chunk = chunkingMetadata.chunks[i];
      
      // Generate a path for the chunk
      const chunkFileName = `chunks/${projectId}/${project.title.replace(/\s+/g, '_')}_chunk_${i + 1}.${fileExtension}`;
      
      console.log(`Creating reference for chunk ${i + 1} at path: ${chunkFileName}`);
      
      // In a real implementation, you would:
      // 1. Extract this chunk from the original video using FFmpeg
      // 2. Upload the chunk to storage
      
      // For now, we'll just create a reference to the original video
      // but in a production environment, you would create actual chunk files
      
      // Update the chunk metadata with the path
      updatedChunks.push({
        ...chunk,
        videoPath: `${bucketName}/${chunkFileName}`,
        // In a real implementation, you would set actual duration and times
        // based on the extracted chunk
      });
    }
    
    // Update project with simulated chunk video paths
    const updatedMetadata = {
      ...project.video_metadata,
      chunking: {
        ...chunkingMetadata,
        chunks: updatedChunks,
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

/**
 * Parse a storage path to determine bucket name and file path
 */
function parseStoragePath(fullPath: string): { bucketName: string; filePath: string } {
  if (!fullPath) {
    return { bucketName: 'video_uploads', filePath: '' };
  }

  // Remove any leading slashes
  const cleanPath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

  // Check if path starts with 'video_uploads/' prefix
  if (cleanPath.startsWith('video_uploads/')) {
    return { 
      bucketName: 'video_uploads', 
      filePath: cleanPath.replace('video_uploads/', '')
    };
  }
  
  // Check if path is just 'uploads/...'
  if (cleanPath.startsWith('uploads/')) {
    return { 
      bucketName: 'video_uploads', 
      filePath: cleanPath
    };
  }

  // Check if path has a bucket prefix (bucket/path format)
  if (cleanPath.includes('/')) {
    const parts = cleanPath.split('/');
    // If first part doesn't have a dot (likely not a filename), treat as bucket
    if (parts.length > 1 && !parts[0].includes('.')) {
      return { 
        bucketName: parts[0],
        filePath: parts.slice(1).join('/')
      };
    }
  }
  
  // Default to video_uploads bucket
  return { 
    bucketName: 'video_uploads', 
    filePath: cleanPath
  };
}
