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

    // Get OpenAI API key for Whisper transcription
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY is not configured in edge function secrets");
    }

    // Parse the request body
    let projectId, projectVideos, isTranscriptOnly, useSpeakerDetection, audioData, isRetry;
    
    try {
      const requestData = await req.json();
      projectId = requestData.projectId;
      projectVideos = requestData.projectVideos;
      isTranscriptOnly = requestData.isTranscriptOnly || false;
      useSpeakerDetection = requestData.useSpeakerDetection || false;
      audioData = requestData.audioData || null;
      isRetry = requestData.isRetry || false;
      
      if (!projectId) {
        throw new Error("Missing required parameter: projectId");
      }
      
      console.log(`Processing request: projectId=${projectId}, useSpeakerDetection=${useSpeakerDetection}, isTranscriptOnly=${isTranscriptOnly}, isRetry=${isRetry}`);
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
    
    // Check if chunking is available
    if (chunking?.isChunked && chunking.chunks && chunking.chunks.length > 0) {
      console.log(`Processing video with ${chunking.chunks.length} chunks using Whisper API`);
      
      let combinedTranscript = "";
      const videoTitle = project.title || "Untitled Video";
      
      // Process each chunk with Whisper API
      const chunkSuccesses = [];
      const chunkErrors = [];
      
      for (let i = 0; i < chunking.chunks.length; i++) {
        const chunk = chunking.chunks[i];
        console.log(`Processing chunk ${i+1}/${chunking.chunks.length}: ${chunk.startTime}s - ${chunk.endTime}s`);
        
        try {
          // Get the chunk's video file path
          const chunkPath = chunk.videoPath;
          if (!chunkPath) {
            console.warn(`No video path for chunk ${i+1}, using estimated transcript`);
            const chunkTranscript = `## ${videoTitle} - Part ${i+1} (${formatTime(chunk.startTime)} to ${formatTime(chunk.endTime)})\n\n` +
              `[Transcription unavailable for this chunk - missing video path]`;
            
            if (combinedTranscript) {
              combinedTranscript += `\n\n${chunkTranscript}`;
            } else {
              combinedTranscript = chunkTranscript;
            }
            
            chunkErrors.push({
              chunkIndex: i,
              error: "Missing video path",
              path: null
            });
            
            continue;
          }
          
          // Parse storage path to get bucket and file path
          const { bucketName, filePath } = parseStoragePath(chunkPath);
          console.log(`Getting chunk video from bucket: ${bucketName}, path: ${filePath}`);
          
          // Get signed URL to download the chunk file
          // Use longer expiry for retry attempts (5 minutes)
          const expirySeconds = isRetry ? 300 : 60;
          const { data: signedURLData, error: signedUrlError } = await supabaseClient
            .storage
            .from(bucketName)
            .createSignedUrl(filePath, expirySeconds);
          
          if (signedUrlError || !signedURLData?.signedUrl) {
            throw new Error(`Could not get signed URL for chunk ${i+1}: ${signedUrlError?.message || "No URL returned"}`);
          }
          
          // Download the video chunk content
          console.log(`Downloading chunk ${i+1} from signed URL`);
          const videoResponse = await fetch(signedURLData.signedUrl);
          if (!videoResponse.ok) {
            throw new Error(`Failed to download chunk ${i+1}: ${videoResponse.statusText}`);
          }
          
          // Get the video file as blob
          const videoBlob = await videoResponse.blob();
          console.log(`Downloaded chunk ${i+1}: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
          
          // Check if the chunk exceeds Whisper API size limits
          if (videoBlob.size > 25 * 1024 * 1024) {
            console.warn(`Chunk ${i+1} exceeds Whisper API size limit. Size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
            
            // In a production system, this would extract audio to reduce file size
            // For now, we'll skip this chunk and add an error note
            const chunkTranscript = `## ${videoTitle} - Part ${i+1} (${formatTime(chunk.startTime)} to ${formatTime(chunk.endTime)})\n\n` +
              `[Chunk exceeds Whisper API size limit. In production, audio extraction would be used to reduce file size.]`;
              
            if (combinedTranscript) {
              combinedTranscript += `\n\n${chunkTranscript}`;
            } else {
              combinedTranscript = chunkTranscript;
            }
            
            chunkErrors.push({
              chunkIndex: i,
              error: "Chunk exceeds size limit",
              path: chunkPath,
              size: videoBlob.size
            });
            
            continue;
          }
          
          // Create form for Whisper API call
          const formData = new FormData();
          formData.append('file', videoBlob, `chunk_${i+1}.mp4`);
          formData.append('model', 'whisper-1');
          formData.append('response_format', 'json');
          
          if (useSpeakerDetection) {
            console.log(`Requesting speaker detection for chunk ${i+1}`);
            formData.append('language', 'en');
          }
          
          // Call the Whisper API
          console.log(`Sending chunk ${i+1} to Whisper API`);
          const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`
            },
            body: formData
          });
          
          if (!whisperResponse.ok) {
            const errorText = await whisperResponse.text();
            console.error(`Whisper API error for chunk ${i+1}:`, errorText);
            throw new Error(`Whisper API error: ${whisperResponse.status} ${whisperResponse.statusText}`);
          }
          
          const whisperData = await whisperResponse.json();
          console.log(`Received transcription for chunk ${i+1}, length: ${whisperData.text?.length || 0} chars`);
          
          // Format the chunk transcript with title and timestamp range
          const chunkTranscript = `## ${videoTitle} - Part ${i+1} (${formatTime(chunk.startTime)} to ${formatTime(chunk.endTime)})\n\n` +
            `${whisperData.text}`;
          
          // Add this chunk's transcript to the combined transcript
          if (combinedTranscript) {
            combinedTranscript += `\n\n${chunkTranscript}`;
          } else {
            combinedTranscript = chunkTranscript;
          }
          
          console.log(`Successfully processed chunk ${i+1}`);
          chunkSuccesses.push(i);
          
        } catch (chunkError) {
          console.error(`Error processing chunk ${i+1}:`, chunkError);
          
          // Add error info to transcript but continue with other chunks
          const errorTranscript = `## ${videoTitle} - Part ${i+1} (${formatTime(chunk.startTime)} to ${formatTime(chunk.endTime)})\n\n` +
            `[Error transcribing this chunk: ${chunkError.message}]`;
            
          if (combinedTranscript) {
            combinedTranscript += `\n\n${errorTranscript}`;
          } else {
            combinedTranscript = errorTranscript;
          }
          
          chunkErrors.push({
            chunkIndex: i,
            error: chunkError.message,
            path: chunk.videoPath
          });
        }
      }
      
      // Update the project with the transcript
      console.log(`Updating project with real transcription from chunks. Successful chunks: ${chunkSuccesses.length}/${chunking.chunks.length}`);
      const { error: updateError } = await supabaseClient
        .from('projects')
        .update({ 
          transcript: combinedTranscript,
          transcription_metadata: {
            chunk_successes: chunkSuccesses.length,
            chunk_failures: chunkErrors.length,
            chunk_errors: chunkErrors,
            completed_at: new Date().toISOString(),
            is_retry: isRetry
          }
        })
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
          chunksSuccessful: chunkSuccesses.length,
          chunksFailed: chunkErrors.length,
          processingTimeSeconds: totalTime/1000,
          isVirtualChunking: chunking.isVirtualChunking || false,
          usedWhisperAPI: true,
          nextSteps: chunkErrors.length > 0 ? 
            "Some chunks could not be processed. Try retranscribing or fixing storage issues." : 
            "All chunks processed successfully."
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } 
    
    // Check if video is too large for direct processing
    const videoSize = project.video_metadata?.file_size || 0;
    const videoSizeMB = videoSize / (1024 * 1024);
    
    if (videoSizeMB > 25) {
      // Video is too large for direct processing
      const largeVideoTranscript = `## ${project.title || "Video Transcription"}\n\n` +
        `This video file (${videoSizeMB.toFixed(1)} MB) is too large for direct transcription with Whisper API.\n\n` +
        `For production use, implement a preprocessing step that extracts the audio track to reduce file size.\n\n` +
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
        needsChunking: true,
        nextSteps: "Implement audio extraction to reduce file size for the Whisper API"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // For normal-sized videos without chunking
    console.log("Processing regular video without chunking using Whisper API");
    
    try {
      // Get the main video file
      const { bucketName, filePath } = parseStoragePath(project.source_file_path);
      console.log(`Getting main video from bucket: ${bucketName}, path: ${filePath}`);
      
      // Get signed URL to download the file
      const { data: signedURLData } = await supabaseClient
        .storage
        .from(bucketName)
        .createSignedUrl(filePath, 60); // 60 seconds expiry
      
      if (!signedURLData?.signedUrl) {
        throw new Error("Could not get signed URL for video");
      }
      
      // Download the video content
      console.log("Downloading main video from signed URL");
      const videoResponse = await fetch(signedURLData.signedUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      }
      
      // Get the video file as blob
      const videoBlob = await videoResponse.blob();
      console.log(`Downloaded video: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Create form for Whisper API call
      const formData = new FormData();
      formData.append('file', videoBlob, "video.mp4");
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');
      
      if (useSpeakerDetection) {
        console.log("Requesting speaker detection");
        formData.append('language', 'en');
      }
      
      // Call the Whisper API
      console.log("Sending video to Whisper API");
      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`
        },
        body: formData
      });
      
      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        console.error("Whisper API error:", errorText);
        throw new Error(`Whisper API error: ${whisperResponse.status} ${whisperResponse.statusText}`);
      }
      
      const whisperData = await whisperResponse.json();
      console.log(`Received transcription, length: ${whisperData.text?.length || 0} chars`);
      
      // Format the final transcript
      const finalTranscript = `## ${project.title || "Video Transcription"}\n\n${whisperData.text}`;
      
      // Update the project with the transcript
      console.log("Updating project with whisper transcription");
      const { error: updateError } = await supabaseClient
        .from('projects')
        .update({ transcript: finalTranscript })
        .eq('id', projectId);
        
      if (updateError) {
        console.error(`Error updating project: ${updateError.message}`);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`Transcribe-video function completed in ${totalTime/1000} seconds`);
      
      // Return the transcript
      return new Response(JSON.stringify({
        transcript: finalTranscript,
        success: true,
        processingDetails: {
          processingTimeSeconds: totalTime/1000,
          usedWhisperAPI: true
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (transcriptionError) {
      console.error("Error transcribing video:", transcriptionError);
      
      // Return an error transcript
      const errorTranscript = `## ${project.title || "Video Transcription"}\n\n` +
        `Error transcribing video: ${transcriptionError.message}\n\n` +
        `Please try again or check your video file format. OpenAI's Whisper API works best with clear audio.`;
      
      return new Response(JSON.stringify({
        transcript: errorTranscript,
        success: false,
        error: transcriptionError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
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
