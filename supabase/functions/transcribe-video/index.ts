
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
        .select('id, source_type, source_file_path, video_metadata')
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
      source_type: project.source_type,
      source_file_path: project.source_file_path,
      has_chunking: chunking?.isChunked ? "Yes" : "No",
      chunks_count: chunking?.chunks?.length || 0,
      chunks_status: chunking?.status || "none",
      file_size: project.video_metadata?.file_size ? 
        `${(project.video_metadata?.file_size / (1024 * 1024)).toFixed(2)} MB` : "Unknown",
      duration: project.video_metadata?.duration ? 
        `${project.video_metadata?.duration.toFixed(1)}s` : "Unknown"
    })}`);
    
    // Variables to store our videos for transcription
    let videosToTranscribe = [];
    
    // First check if we have project videos from the request (chunked processing)
    if (projectVideos && projectVideos.length > 0) {
      console.log("Using provided project videos for transcription");
      videosToTranscribe = projectVideos;
      
      // Additional logging for chunked videos
      console.log(`Received ${projectVideos.length} video chunks:`);
      projectVideos.forEach((video, index) => {
        console.log(`Chunk ${index+1}: path=${video.source_file_path}, title=${video.title || 'Untitled'}`);
      });
    }
    // Otherwise use the main project video
    else {
      console.log("Using project's main video");
      
      if (project.source_file_path && project.source_type === 'video') {
        videosToTranscribe.push({
          source_file_path: project.source_file_path,
          title: "Main Video",
          video_metadata: project.video_metadata
        });
      } else {
        console.warn("Project has no valid source_file_path or is not a video type");
      }
    }
    
    // Check if we have any videos to transcribe
    if (videosToTranscribe.length === 0) {
      return new Response(JSON.stringify({
        error: "No valid videos found to transcribe"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Process each video and generate a combined transcript
    let combinedTranscript = "";
    let totalAudioMinutes = 0;
    let errorCount = 0;
    let successCount = 0;
    
    // For each video, process its transcription
    for (let i = 0; i < videosToTranscribe.length; i++) {
      const video = videosToTranscribe[i];
      console.log(`Processing video ${i+1}/${videosToTranscribe.length}: ${video.source_file_path || "No path"}`);
      
      if (!video.source_file_path) {
        console.error(`Video ${i+1} has no source_file_path, skipping`);
        errorCount++;
        continue;
      }
      
      // Parse the storage path to get bucket and file path
      const parsedPath = parseStoragePath(video.source_file_path);
      console.log(`Resolved storage path - Bucket: ${parsedPath.bucketName}, File path: ${parsedPath.filePath}`);
      
      // For large videos, check if this is a chunked video
      const isChunkedVideo = chunking?.isChunked || false;
      console.log(`This video ${isChunkedVideo ? 'is' : 'is not'} marked for chunking`);
      
      try {
        console.log(`Attempting to download video file from storage: ${parsedPath.bucketName}/${parsedPath.filePath}`);
        
        // First check if the file exists
        const { data: fileExists, error: listError } = await supabaseClient.storage
          .from(parsedPath.bucketName)
          .list(parsedPath.filePath.split('/').slice(0, -1).join('/') || '');
          
        if (listError) {
          console.error(`Error listing files: ${JSON.stringify(listError)}`);
          throw new Error(`Storage listing error: ${listError.message}`);
        }
        
        const fileName = parsedPath.filePath.split('/').pop();
        const fileFound = fileExists?.some(file => file.name === fileName);
        
        if (!fileFound) {
          console.error(`File not found in storage: ${parsedPath.bucketName}/${parsedPath.filePath}`);
          throw new Error("File not found in storage");
        }
        
        // Download the video file from storage
        const { data: fileData, error: downloadError } = await supabaseClient.storage
          .from(parsedPath.bucketName)
          .download(parsedPath.filePath);
          
        if (downloadError) {
          console.error(`Error downloading video file: ${JSON.stringify(downloadError)}`);
          
          // If this is a chunked video, we can try to continue with other chunks
          if (isChunkedVideo && videosToTranscribe.length > 1) {
            console.error(`Skipping chunk ${i+1} due to download error`);
            errorCount++;
            continue;
          }
          
          if (videosToTranscribe.length === 1) {
            // When only one video is being processed, return a clear error
            return new Response(JSON.stringify({
              error: `Failed to download video file: ${downloadError.message || "Storage access error"}`
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          // Otherwise we'll just skip this chunk and continue
          continue;
        }
        
        if (!fileData) {
          console.error("Downloaded file data is null");
          
          if (isChunkedVideo && videosToTranscribe.length > 1) {
            console.error(`Skipping chunk ${i+1} due to empty file data`);
            errorCount++;
            continue;
          }
          
          if (videosToTranscribe.length === 1) {
            return new Response(JSON.stringify({
              error: "Downloaded file data is empty"
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          continue;
        }
        
        // Convert the file data to a buffer
        const videoBuffer = await fileData.arrayBuffer();
        const videoSizeMB = videoBuffer.byteLength / (1024 * 1024);
        console.log(`Video file downloaded successfully, size: ${videoSizeMB.toFixed(2)} MB`);
        
        // If this is not a chunked video and the file is too large for OpenAI (>25MB)
        // We need to send an error message that the video needs to be chunked
        if (!isChunkedVideo && videoSizeMB > 25) {
          console.log("Video file is too large for OpenAI API, checking if it's a chunked video");
          
          // If we're in chunking mode and have multiple videos, continue with other chunks
          if (videosToTranscribe.length > 1) {
            console.log("Skipping large video chunk, will continue with others");
            continue;
          }
          
          // For non-chunked videos, return a message to use the chunking process
          const singleVideoTranscript = "## Main Video\n\nThis video file is too large for direct transcription. Please use the \"Re-Transcribe Video\" button to process with automatic chunking.";
          
          // For large videos, we'll add the message to the combined transcript
          if (combinedTranscript) {
            combinedTranscript += `\n\n${singleVideoTranscript}`;
          } else {
            combinedTranscript = singleVideoTranscript;
          }
          
          // We'll skip trying to transcribe this large file
          continue;
        }
        
        // Here we would normally call the OpenAI API to transcribe the video
        // For this example, we'll just return a mock transcript
        const singleVideoTranscript = `## ${video.title || "Video Section"}\n\nThis is a mock transcript for video ${i+1} (${video.title || "Untitled"}). In a real implementation, this would be generated using OpenAI's Whisper API or another transcription service.`;
        
        // Add estimated audio minutes for usage tracking
        const duration = video.video_metadata?.duration || 5;
        totalAudioMinutes += Math.ceil(duration / 60);
        
        // Add this video's transcript to the combined transcript
        if (combinedTranscript) {
          combinedTranscript += `\n\n${singleVideoTranscript}`;
        } else {
          combinedTranscript = singleVideoTranscript;
        }
        
        successCount++;
      } catch (error) {
        console.error(`Error processing video ${i+1}: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        
        errorCount++;
        
        // If this is a chunked video, try to continue with other chunks
        if (isChunkedVideo && videosToTranscribe.length > 1) {
          console.error(`Skipping chunk ${i+1} due to processing error`);
          continue;
        }
        
        // If we've attempted all videos and all failed, return an error
        if (i === videosToTranscribe.length - 1 && successCount === 0) {
          return new Response(JSON.stringify({
            error: `Failed to process any videos: ${error.message}`
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }
    
    // If we couldn't generate any transcript, return an error
    if (!combinedTranscript) {
      return new Response(JSON.stringify({
        error: "Could not generate any transcript",
        details: `Processed ${videosToTranscribe.length} videos with ${errorCount} errors and ${successCount} successful transcriptions`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Generated combined transcript with ${combinedTranscript.length} chars from ${successCount} videos (${errorCount} failed)`);
    console.log(`First 200 chars of transcript: ${combinedTranscript.substring(0, 200)}`);
    
    // Log usage for billing/analytics - in a real implementation this would be more sophisticated
    console.log(`Recording usage data for ${totalAudioMinutes} minutes of audio`);
    
    // Update the project with the transcript
    console.log("Updating project with transcript");
    const { error: updateError } = await supabaseClient
      .from('projects')
      .update({ transcript: combinedTranscript })
      .eq('id', projectId);
      
    if (updateError) {
      console.error(`Error updating project: ${updateError.message}`);
      // We'll continue and return the transcript even if the update fails
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`Transcribe-video function completed in ${totalTime/1000} seconds`);
    
    // Return the transcript
    return new Response(JSON.stringify({
      transcript: combinedTranscript,
      processingDetails: {
        videosProcessed: videosToTranscribe.length,
        successfulTranscriptions: successCount,
        failedTranscriptions: errorCount,
        processingTimeSeconds: totalTime/1000
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`Error in transcribe video function: ${error.message}`);
    console.error(`Full stack trace: ${error.stack}`);
    
    return new Response(JSON.stringify({
      error: `Transcription failed: ${error.message}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

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
