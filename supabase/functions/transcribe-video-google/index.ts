
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse Google Cloud credentials from environment variable
function getGoogleCredentials() {
  const credsString = Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS');
  if (!credsString) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not configured in edge function secrets");
  }
  
  try {
    return JSON.parse(credsString);
  } catch (e) {
    console.error("Error parsing Google credentials:", e);
    throw new Error("Invalid GOOGLE_APPLICATION_CREDENTIALS format");
  }
}

// Format time in MM:SS or HH:MM:SS format
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

// Parse storage path to extract bucket and file path
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

// Send audio to Google Speech-to-Text API
async function transcribeWithGoogleSpeech(audioData: Blob, options: {
  detectSpeakers?: boolean,
  languageCode?: string
} = {}) {
  try {
    const credentials = getGoogleCredentials();
    
    // First, get an access token using the service account credentials
    const tokenResponse = await fetch(
      `https://www.googleapis.com/oauth2/v4/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: generateJWT(credentials),
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get Google access token: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Convert audio blob to base64
    const arrayBuffer = await audioData.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    // Prepare request for Speech-to-Text API
    const requestBody = {
      config: {
        encoding: 'MP3',
        sampleRateHertz: 44100,
        languageCode: options.languageCode || 'en-US',
        enableAutomaticPunctuation: true,
        model: 'default',
        useEnhanced: true,
        enableWordTimeOffsets: true,
        diarizationConfig: options.detectSpeakers ? {
          enableSpeakerDiarization: true,
          minSpeakerCount: 1,
          maxSpeakerCount: 6,
        } : undefined,
      },
      audio: {
        content: base64Audio,
      },
    };

    // Call the Speech-to-Text API
    const speechResponse = await fetch(
      'https://speech.googleapis.com/v1/speech:recognize',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!speechResponse.ok) {
      const errorText = await speechResponse.text();
      throw new Error(`Google Speech API error: ${speechResponse.status} ${errorText}`);
    }

    return await speechResponse.json();
  } catch (error) {
    console.error("Error in Google Speech transcription:", error);
    throw error;
  }
}

// Generate a JWT for Google API authentication
function generateJWT(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const expiryTime = now + 3600; // Token valid for 1 hour
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: credentials.private_key_id,
  };
  
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://www.googleapis.com/oauth2/v4/token',
    exp: expiryTime,
    iat: now,
  };
  
  // Base64 encode header and claim
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  const encodedClaim = btoa(JSON.stringify(claim))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  // Create unsigned token
  const signInput = `${encodedHeader}.${encodedClaim}`;
  
  // Sign the token using the private key
  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(signInput);
  
  // Use crypto.subtle to sign with RS256
  const privateKey = credentials.private_key;
  
  // This is a simplified implementation - in production, you'd use proper JWT libraries
  // For Deno edge functions, we need to implement basic JWT signing
  // This is for demonstration - consider using a JWT library when available
  const signature = signWithPEM(data, privateKey);
  
  return `${signInput}.${signature}`;
}

// Simplified PEM signing function (placeholder)
function signWithPEM(data, privateKeyPEM) {
  // In a real implementation, you would use proper crypto libraries to sign
  // Since this is just for demonstration, we're returning a placeholder
  // You would need to implement proper RS256 signing here
  console.warn("WARNING: Using placeholder JWT signing - replace with proper implementation");
  
  // For testing purposes, we're returning a dummy signature
  // In production, implement proper RS256 signing
  return "DUMMY_SIGNATURE_REPLACE_WITH_REAL_IMPLEMENTATION";
}

// Process Google Speech API response into app-compatible format
function formatGoogleSpeechResponse(response, videoTitle) {
  if (!response || !response.results || response.results.length === 0) {
    return "No transcription available.";
  }
  
  let transcript = '';
  const results = response.results;
  
  // If we have speaker diarization
  if (results[0].alternatives[0].words && 
      results[0].alternatives[0].words.length > 0 && 
      results[0].alternatives[0].words[0].speakerTag !== undefined) {
    
    // Group words by speaker
    let currentSpeaker = null;
    let currentText = '';
    const speakerSegments = [];
    
    results.forEach(result => {
      if (!result.alternatives[0] || !result.alternatives[0].words) return;
      
      result.alternatives[0].words.forEach(wordInfo => {
        if (currentSpeaker !== wordInfo.speakerTag) {
          if (currentText) {
            speakerSegments.push({
              speaker: currentSpeaker,
              text: currentText.trim()
            });
          }
          currentSpeaker = wordInfo.speakerTag;
          currentText = wordInfo.word + ' ';
        } else {
          currentText += wordInfo.word + ' ';
        }
      });
    });
    
    // Add the last segment
    if (currentText) {
      speakerSegments.push({
        speaker: currentSpeaker,
        text: currentText.trim()
      });
    }
    
    // Format with speaker labels
    transcript = `## ${videoTitle || "Video Transcription"}\n\n`;
    speakerSegments.forEach(segment => {
      transcript += `Speaker ${segment.speaker}: ${segment.text}\n\n`;
    });
    
  } else {
    // Standard transcript without speakers
    transcript = `## ${videoTitle || "Video Transcription"}\n\n`;
    results.forEach(result => {
      transcript += result.alternatives[0].transcript + " ";
    });
  }
  
  return transcript.trim();
}

// Format chunked transcripts for improved readability
function formatChunkedTranscript(chunk, videoTitle, chunkIndex, startTime, endTime) {
  if (!chunk || !chunk.results || chunk.results.length === 0) {
    return `## ${videoTitle} - Part ${chunkIndex + 1} (${formatTime(startTime)} to ${formatTime(endTime)})\n\n[No transcription available for this segment]`;
  }
  
  let chunkTranscript = `## ${videoTitle} - Part ${chunkIndex + 1} (${formatTime(startTime)} to ${formatTime(endTime)})\n\n`;
  
  // Check if we have speaker diarization
  if (chunk.results[0].alternatives[0].words && 
      chunk.results[0].alternatives[0].words.length > 0 && 
      chunk.results[0].alternatives[0].words[0].speakerTag !== undefined) {
    
    // Group words by speaker
    let currentSpeaker = null;
    let currentText = '';
    const speakerSegments = [];
    
    chunk.results.forEach(result => {
      if (!result.alternatives[0] || !result.alternatives[0].words) return;
      
      result.alternatives[0].words.forEach(wordInfo => {
        if (currentSpeaker !== wordInfo.speakerTag) {
          if (currentText) {
            speakerSegments.push({
              speaker: currentSpeaker,
              text: currentText.trim()
            });
          }
          currentSpeaker = wordInfo.speakerTag;
          currentText = wordInfo.word + ' ';
        } else {
          currentText += wordInfo.word + ' ';
        }
      });
    });
    
    // Add the last segment
    if (currentText) {
      speakerSegments.push({
        speaker: currentSpeaker,
        text: currentText.trim()
      });
    }
    
    // Format with speaker labels
    speakerSegments.forEach(segment => {
      chunkTranscript += `Speaker ${segment.speaker}: ${segment.text}\n\n`;
    });
    
  } else {
    // Standard transcript without speakers
    chunk.results.forEach(result => {
      chunkTranscript += result.alternatives[0].transcript + " ";
    });
  }
  
  return chunkTranscript.trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Google transcribe-video function called");
    const startTime = Date.now();
    
    // Create a Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
      console.log(`Processing video with ${chunking.chunks.length} chunks using Google Speech API`);
      
      let combinedTranscript = "";
      const videoTitle = project.title || "Untitled Video";
      
      // Process each chunk with Google Speech API
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
          
          // Transcribe with Google Speech API
          console.log(`Sending chunk ${i+1} to Google Speech API`);
          const speechResponse = await transcribeWithGoogleSpeech(videoBlob, {
            detectSpeakers: useSpeakerDetection
          });
          
          console.log(`Received transcription for chunk ${i+1}`);
          
          // Format the chunk transcript with title and timestamp range
          const chunkTranscript = formatChunkedTranscript(
            speechResponse, 
            videoTitle, 
            i, 
            chunk.startTime, 
            chunk.endTime
          );
          
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
            is_retry: isRetry,
            provider: 'google'
          }
        })
        .eq('id', projectId);
        
      if (updateError) {
        console.error(`Error updating project: ${updateError.message}`);
        // We'll continue and return the transcript even if the update fails
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`Google transcribe-video function for chunked video completed in ${totalTime/1000} seconds`);
      
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
          usedGoogleSpeechAPI: true,
          nextSteps: chunkErrors.length > 0 ? 
            "Some chunks could not be processed. Try retranscribing or fixing storage issues." : 
            "All chunks processed successfully."
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } 
    
    // For standard-sized videos without chunking
    console.log("Processing regular video without chunking using Google Speech API");
    
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
      
      // Transcribe with Google Speech API
      console.log("Sending video to Google Speech API");
      const speechResponse = await transcribeWithGoogleSpeech(videoBlob, {
        detectSpeakers: useSpeakerDetection
      });
      
      console.log(`Received transcription from Google Speech API`);
      
      // Format the final transcript
      const finalTranscript = formatGoogleSpeechResponse(
        speechResponse,
        project.title || "Video Transcription"
      );
      
      // Update the project with the transcript
      console.log("Updating project with Google transcription");
      const { error: updateError } = await supabaseClient
        .from('projects')
        .update({ 
          transcript: finalTranscript,
          transcription_metadata: {
            provider: 'google',
            completed_at: new Date().toISOString()
          }
        })
        .eq('id', projectId);
        
      if (updateError) {
        console.error(`Error updating project: ${updateError.message}`);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`Google transcribe-video function completed in ${totalTime/1000} seconds`);
      
      // Return the transcript
      return new Response(JSON.stringify({
        transcript: finalTranscript,
        success: true,
        processingDetails: {
          processingTimeSeconds: totalTime/1000,
          usedGoogleSpeechAPI: true
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (transcriptionError) {
      console.error("Error transcribing video with Google Speech:", transcriptionError);
      
      // Return an error transcript
      const errorTranscript = `## ${project.title || "Video Transcription"}\n\n` +
        `Error transcribing video: ${transcriptionError.message}\n\n` +
        `Please try again or check your video file format. Google Speech API works best with clear audio.`;
      
      return new Response(JSON.stringify({
        transcript: errorTranscript,
        success: false,
        error: transcriptionError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error(`Error in Google transcribe video function: ${error.message}`);
    console.error(`Full stack trace: ${error.stack}`);
    
    return new Response(JSON.stringify({
      error: `Google transcription failed: ${error.message}`,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
