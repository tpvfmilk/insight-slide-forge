
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Transcribe-video function called");
    const startTime = Date.now();
    
    // Create a Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the request body
    let projectId, projectVideos, isTranscriptOnly, useSpeakerDetection, audioData;
    
    try {
      const requestData = await req.json();
      projectId = requestData.projectId;
      projectVideos = requestData.projectVideos;
      isTranscriptOnly = requestData.isTranscriptOnly || false;
      useSpeakerDetection = requestData.useSpeakerDetection || false;
      audioData = requestData.audioData || null;
      
      if (!projectId) {
        throw new Error("Missing required parameter: projectId");
      }
      
      console.log(`Processing request: projectId=${projectId}, useSpeakerDetection=${useSpeakerDetection}, isTranscriptOnly=${isTranscriptOnly}`);
      console.log(`Has audioData: ${audioData !== null}, audioData length: ${audioData?.length || 0}`);
      console.log(`Project videos provided: ${projectVideos?.length || 0}`);
    } catch (jsonError) {
      console.error(`Error parsing request JSON: ${jsonError.message}`);
      return new Response(JSON.stringify({
        error: `Invalid request format: ${jsonError.message}`
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Get the project details
    let project;
    try {
      const { data: projectData, error: projectError } = await supabaseClient
        .from('projects')
        .select('id, source_type, source_file_path, video_metadata, title')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error("Error fetching project:", projectError);
        throw new Error(`Project not found: ${projectError?.message}`);
      }
      
      if (!projectData) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      project = projectData;
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Enhanced debug logging for project data
    const chunking = project.video_metadata?.chunking || null;
    console.log(`Project data: ${JSON.stringify({
      id: project.id,
      title: project.title,
      source_type: project.source_type,
      source_file_path: project.source_file_path,
      has_chunking: chunking?.isChunked ? "Yes" : "No",
      chunks_count: chunking?.chunks?.length || 0,
      chunks_status: chunking?.status || "none",
      is_virtual_chunking: chunking?.isVirtualChunking ? "Yes" : "No",
      file_size: project.video_metadata?.file_size ? 
        `${(project.video_metadata?.file_size / (1024 * 1024)).toFixed(2)} MB` : "Unknown",
      duration: project.video_metadata?.duration ? 
        `${project.video_metadata?.duration.toFixed(1)}s` : "Unknown"
    })}`);
    
    // Check if video is too large for direct processing
    const videoSize = project.video_metadata?.file_size || 0;
    const videoSizeMB = videoSize / (1024 * 1024);
    
    // Use chunk information if available
    if (chunking?.isChunked && chunking.chunks && chunking.chunks.length > 0) {
      console.log(`Processing video with ${chunking.chunks.length} chunks`);
      
      // Process each chunk as a section of the video - for now generating mock transcripts
      // In a real implementation, this would process each chunk through a transcription service
      
      let combinedTranscript = "";
      const videoTitle = project.title || "Untitled Video";
      
      // Process each chunk
      for (let i = 0; i < chunking.chunks.length; i++) {
        const chunk = chunking.chunks[i];
        console.log(`Processing chunk ${i+1}/${chunking.chunks.length}: ${chunk.startTime}s - ${chunk.endTime}s`);
        
        // In a real implementation, we would:
        // 1. Download the chunk video or extract the time range from the original
        // 2. Send to transcription API
        // 3. Get back the transcript text
        
        // For now, we'll generate a mock transcript for the chunk
        const chunkTranscript = `## ${videoTitle} - Part ${i+1} (${formatTime(chunk.startTime)} to ${formatTime(chunk.endTime)})\n\n` +
          `This is a mock transcript for chunk ${i+1}. In a real implementation, this would be generated using a transcription API.\n` +
          `The chunk covers from ${formatTime(chunk.startTime)} to ${formatTime(chunk.endTime)} of the video.\n\n`;
        
        // Add this chunk's transcript to the combined transcript
        if (combinedTranscript) {
          combinedTranscript += `\n\n${chunkTranscript}`;
        } else {
          combinedTranscript = chunkTranscript;
        }
      }
      
      // Add a note about large video processing
      if (videoSizeMB > 25) {
        combinedTranscript += `\n\n---\n\n**Note:** This video (${videoSizeMB.toFixed(1)} MB) was processed in ${chunking.chunks.length} chunks due to its large size. ` +
          `The transcription shown is a placeholder. In a production environment, each chunk would be sent to a transcription service.`;
      }
      
      // Update the project with the transcript
      console.log("Updating project with chunked transcript");
      const { error: updateError } = await supabaseClient
        .from('projects')
        .update({ transcript: combinedTranscript })
        .eq('id', projectId);
        
      if (updateError) {
        console.error(`Error updating project: ${updateError.message}`);
        // We'll continue and return the transcript even if the update fails
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`Transcribe-video function for chunked video completed in ${totalTime/1000} seconds`);
      
      // Return the transcript
      return new Response(JSON.stringify({
        transcript: combinedTranscript,
        success: true,
        processingDetails: {
          chunksProcessed: chunking.chunks.length,
          processingTimeSeconds: totalTime/1000,
          isVirtualChunking: chunking.isVirtualChunking || false
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } 
    
    // If no chunking or there was another approach needed
    if (videoSizeMB > 25) {
      // Video is too large for direct processing
      const largeVideoTranscript = `## ${project.title || "Video Transcription"}\n\n` +
        `This video file (${videoSizeMB.toFixed(1)} MB) is too large for direct transcription and needs to be processed in chunks.\n\n` +
        `Please use the "Re-Transcribe Video" button to process with automatic chunking.`;
        
      // Update the project with the message
      const { error: updateError } = await supabaseClient
        .from('projects')
        .update({ transcript: largeVideoTranscript })
        .eq('id', projectId);
      
      if (updateError) {
        console.error(`Error updating project: ${updateError.message}`);
      }
      
      return new Response(JSON.stringify({
        transcript: largeVideoTranscript,
        success: true,
        needsChunking: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // For normal-sized videos without chunking (fallback logic)
    console.log("Processing regular video without chunking");
    
    // In a real implementation, we'd process the full video
    // For now, we'll generate a mock transcript
    const mockTranscript = `## ${project.title || "Video Transcription"}\n\n` +
      `This is a mock transcript for demonstration purposes. In a production environment, ` +
      `this would be the result of sending the video to a transcription service like OpenAI Whisper API.`;
      
    // Update the project with the transcript
    console.log("Updating project with standard transcript");
    const { error: updateError } = await supabaseClient
      .from('projects')
      .update({ transcript: mockTranscript })
      .eq('id', projectId);
      
    if (updateError) {
      console.error(`Error updating project: ${updateError.message}`);
      // We'll continue and return the transcript even if the update fails
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`Transcribe-video function completed in ${totalTime/1000} seconds`);
    
    // Return the transcript
    return new Response(JSON.stringify({
      transcript: mockTranscript,
      success: true,
      processingDetails: {
        processingTimeSeconds: totalTime/1000
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`Error in transcribe video function: ${error.message}`);
    console.error(`Full stack trace: ${error.stack}`);
    
    return new Response(JSON.stringify({
      error: `Transcription failed: ${error.message}`,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to format time in MM:SS or HH:MM:SS format
function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "00:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

function parseStoragePath(fullPath) {
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
  
  // Check if path starts with 'chunks/' prefix (for chunked videos)
  if (cleanPath.startsWith('chunks/')) {
    return {
      bucketName: 'chunks',
      filePath: cleanPath.replace('chunks/', '')
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
