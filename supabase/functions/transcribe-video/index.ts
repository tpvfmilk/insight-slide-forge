
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize the Supabase client - added missing initialization
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIKey = Deno.env.get('OPENAI_API_KEY') || '';

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add this helper function to better handle chunked video transcription
async function processChunkedVideo(video, useSpeakerDetection) {
  console.log(`Processing chunked video with ${video.video_metadata.chunked_video_metadata.chunks.length} chunks`);
  
  const chunks = video.video_metadata.chunked_video_metadata.chunks;
  const chunksCount = chunks.length;
  const chunkTranscripts = [];
  
  for (let j = 0; j < chunks.length; j++) {
    const chunk = chunks[j];
    console.log(`Processing chunk ${j + 1}/${chunksCount}: ${chunk.chunkPath}`);
    
    try {
      // Download the chunk file from storage
      const { data: chunkData, error: chunkError } = await supabase
        .storage
        .from('video_uploads')
        .download(chunk.chunkPath);
        
      if (chunkError || !chunkData) {
        console.error(`Failed to download chunk ${j + 1}:`, chunkError);
        continue; // Skip this chunk but continue with others
      }
      
      // Process this chunk with retries
      let attempts = 0;
      let chunkTranscript = null;
      let success = false;
      
      while (attempts < 3 && !success) {
        try {
          console.log(`Attempt ${attempts + 1} to transcribe chunk ${j + 1}`);
          chunkTranscript = await transcribeVideoFile(chunkData, useSpeakerDetection);
          success = true;
        } catch (error) {
          console.error(`Attempt ${attempts + 1} failed for chunk ${j + 1}:`, error);
          attempts++;
          // Short pause before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (chunkTranscript) {
        // Add to the chunk transcripts with timestamp information
        const formattedStartTime = formatTimestamp(chunk.startTime);
        const chunkHeader = `\n\n## Part ${j + 1} [${formattedStartTime}]\n\n`;
        chunkTranscripts.push(chunkHeader + chunkTranscript);
        console.log(`Successfully transcribed chunk ${j + 1}/${chunksCount}`);
      } else {
        console.error(`Failed to transcribe chunk ${j + 1} after ${attempts} attempts`);
      }
    } catch (error) {
      console.error(`Error processing chunk ${j + 1}:`, error);
    }
  }
  
  // Return the combined transcripts
  if (chunkTranscripts.length === 0) {
    return null;
  }
  
  const videoTitle = video.title || "Video";
  const videoHeader = `\n\n# ${videoTitle}\n\n`;
  return videoHeader + chunkTranscripts.join("\n\n");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Transcribe-video function called");
    const startTime = Date.now();
    
    const { 
      projectId, 
      audioData, 
      useSpeakerDetection = false, 
      isTranscriptOnly = false,
      projectVideos = [],
      processChunks = true
    } = await req.json();

    console.log(`Processing request: projectId=${projectId}, useSpeakerDetection=${useSpeakerDetection}, isTranscriptOnly=${isTranscriptOnly}, processChunks=${processChunks}`);
    console.log(`Has audioData: ${Boolean(audioData)}, audioData length: ${audioData ? audioData.length : 0}`);
    console.log(`Project videos provided: ${projectVideos.length}`);

    if (!projectId && !audioData) {
      return new Response(
        JSON.stringify({ error: "Project ID or audio data is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let project;
    let combinedTranscript = "";
    let userId;

    // Handle direct audio data (from client-side extraction)
    if (audioData) {
      console.log(`Processing directly provided audio data (${(audioData.length / 1024 / 1024).toFixed(2)}MB base64)`);
      
      // Process the single audio stream
      const singleTranscript = await processAudioData(audioData);
      if (singleTranscript) {
        combinedTranscript = singleTranscript;
      }
    } 
    // Handle project with video files stored in Supabase
    else {
      console.log("Processing project with ID:", projectId);
      
      // Get project details from database
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError || !projectData) {
        console.error("Project not found:", projectError);
        return new Response(
          JSON.stringify({ error: "Project not found", details: projectError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      project = projectData;
      userId = project.user_id;

      // Determine which videos to process
      let videosToProcess = [];
      
      if (projectVideos && projectVideos.length > 0) {
        console.log(`Using ${projectVideos.length} videos provided in request`);
        videosToProcess = projectVideos;
      } else {
        // Fallback to using the project's main video
        if (project.source_type === 'video' && project.source_file_path) {
          console.log("Using project's main video");
          videosToProcess = [{
            id: null,
            project_id: projectId,
            source_file_path: project.source_file_path,
            title: "Main Video",
            video_metadata: project.video_metadata
          }];
        } else {
          // Try to get videos from project_videos table as another fallback
          console.log("Fetching videos from project_videos table");
          const { data: projectVideosData, error: projectVideosError } = await supabase
            .from('project_videos')
            .select('*')
            .eq('project_id', projectId)
            .order('display_order', { ascending: true });
            
          if (!projectVideosError && projectVideosData && projectVideosData.length > 0) {
            videosToProcess = projectVideosData;
            console.log(`Found ${projectVideosData.length} videos in project_videos table`);
          }
        }
      }
      
      if (videosToProcess.length === 0) {
        console.error("No videos available for transcription");
        return new Response(
          JSON.stringify({ error: "No videos available for transcription" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Processing ${videosToProcess.length} videos for transcription`);
      
      // Process each video and combine the transcripts
      const transcripts = [];
      
      for (let i = 0; i < videosToProcess.length; i++) {
        const video = videosToProcess[i];
        console.log(`Processing video ${i + 1}/${videosToProcess.length}: ${video.source_file_path}`);
        
        try {
          // Check if the video is chunked
          const isChunkedVideo = video.video_metadata?.chunked_video_metadata?.isChunked === true;
          
          if (isChunkedVideo && processChunks) {
            // Use our improved chunk processing function
            const chunkedTranscript = await processChunkedVideo(video, useSpeakerDetection);
            
            if (chunkedTranscript) {
              transcripts.push(chunkedTranscript);
            }
          } else {
            // Process as a regular video (non-chunked)
            // Download the video file from storage
            console.log("Downloading video file from storage:", video.source_file_path);
            const { data: videoData, error: fileError } = await supabase
              .storage
              .from('video_uploads')
              .download(video.source_file_path);
            
            if (fileError || !videoData) {
              console.error("Failed to download video file:", fileError);
              continue; // Skip this video but continue with others
            }
            
            console.log("Video file downloaded successfully");
            
            // Process this video file
            const videoTitle = video.title || `Video ${i + 1}`;
            const videoTranscript = await transcribeVideoFile(videoData, useSpeakerDetection);
            
            if (videoTranscript) {
              // Add a header with the video title - use ## for consistency
              const videoHeader = `\n\n## ${videoTitle}\n\n`;
              transcripts.push(videoHeader + videoTranscript);
            }
          }
        } catch (error) {
          console.error(`Error processing video ${i + 1}:`, error);
          // Continue with other videos
        }
      }
      
      // Combine all transcripts
      combinedTranscript = transcripts.join("\n\n");
      
      if (combinedTranscript.trim() === "") {
        console.error("Failed to generate any transcripts");
        return new Response(
          JSON.stringify({ error: "Failed to transcribe any videos" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Generated combined transcript with ${combinedTranscript.length} chars from ${transcripts.length} videos or chunks`);
      console.log("First 200 chars of transcript:", combinedTranscript.substring(0, 200));
    }

    // For direct audio processing (transcript-only mode)
    if (audioData && !projectId) {
      console.log("Returning transcript without storing");
      return new Response(
        JSON.stringify({ success: true, transcript: combinedTranscript }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track the token usage for transcriptions if we have a user_id
    if (userId) {
      try {
        // Calculate an estimated duration for all processed videos
        let totalAudioMinutes = 0;
        
        if (projectVideos && projectVideos.length > 0) {
          totalAudioMinutes = projectVideos.reduce((total, video) => {
            const duration = video.video_metadata?.duration 
              ? Math.ceil(video.video_metadata.duration / 60)
              : 5; // Default estimate
            return total + duration;
          }, 0);
        } else if (project?.video_metadata?.duration) {
          totalAudioMinutes = Math.ceil(project.video_metadata.duration / 60);
        } else {
          totalAudioMinutes = 5; // Default estimate
        }
        
        const estimatedTokens = totalAudioMinutes * 1000;
        const estimatedCost = totalAudioMinutes * 0.006; // $0.006 per minute for whisper-1

        // Insert usage data into openai_usage table
        console.log(`Recording usage data for ${totalAudioMinutes} minutes of audio`);
        const { error: usageError } = await supabase
          .from('openai_usage')
          .insert({
            user_id: userId,
            project_id: projectId,
            model_id: 'whisper-1',
            input_tokens: estimatedTokens,
            output_tokens: 0, // Whisper doesn't have output tokens in the same way
            total_tokens: estimatedTokens,
            estimated_cost: estimatedCost
          });

        if (usageError) {
          console.error("Error recording token usage:", usageError);
          // Continue with the function even if usage tracking fails
        }
      } catch (usageError) {
        console.error("Error in usage tracking:", usageError);
        // Continue even if usage tracking fails
      }
    }

    // Update the project with the transcript
    console.log("Updating project with transcript");
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        transcript: combinedTranscript,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      console.error("Failed to update project with transcript:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update project with transcript", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this is a transcript-only project and we should delete the source file
    if (isTranscriptOnly && project && project.source_file_path) {
      try {
        console.log(`Deleting source file ${project.source_file_path} for transcript-only project`);
        await supabase.storage.from('video_uploads').remove([project.source_file_path]);
        
        // Update project to reflect the file has been deleted
        await supabase
          .from('projects')
          .update({ 
            source_file_path: null,
          })
          .eq('id', projectId);
      } catch (deleteError) {
        console.error("Error deleting source file:", deleteError);
        // Continue regardless of file deletion success
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`Transcribe-video function completed in ${totalTime/1000} seconds`);

    return new Response(
      JSON.stringify({ success: true, transcript: combinedTranscript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in transcribe-video function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Process audio data directly (from base64)
 */
async function processAudioData(audioData: string): Promise<string | null> {
  console.log(`Processing audio data (${(audioData.length / 1024 / 1024).toFixed(2)}MB base64)`);
  
  try {
    // Process audio data in chunks to avoid memory issues
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(audioData.length / chunkSize);
    
    console.log(`Processing audio in ${totalChunks} chunks`);
    
    const bytes = new Uint8Array(audioData.length);
    
    // Process chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, audioData.length);
      const chunk = audioData.substring(start, end);
      
      // Decode the base64 chunk
      const binaryChunk = atob(chunk);
      for (let j = 0; j < binaryChunk.length; j++) {
        bytes[start + j] = binaryChunk.charCodeAt(j);
      }
      
      console.log(`Processed chunk ${i + 1}/${totalChunks}`);
    }
    
    const audioBlob = new Blob([bytes], { type: 'audio/mp3' });
    console.log(`Audio blob created, size: ${audioBlob.size / 1024 / 1024} MB`);
    
    // Transcribe the audio blob
    return await transcribeAudioBlob(audioBlob);
  } catch (e) {
    console.error("Error processing audio data:", e);
    return null;
  }
}

/**
 * Transcribe an audio blob using OpenAI Whisper API
 */
async function transcribeAudioBlob(audioBlob: Blob, useSpeakerDetection = false): Promise<string | null> {
  try {
    // Create form data for OpenAI API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Default to English
    
    // For speaker detection, we use the response_format 'verbose_json'
    if (useSpeakerDetection) {
      console.log("Enabling speaker detection with verbose_json format");
      formData.append('response_format', 'verbose_json');
    }
    
    // Call OpenAI's Whisper API for transcription
    console.log("Calling OpenAI Whisper API for transcription");
    
    const whisperStart = Date.now();
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API timeout after 40 seconds")), 40000);
    });
    
    // Make the API call with timeout
    const apiCallPromise = fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: formData
    });
    
    // Use Promise.race to implement timeout
    const openAIResponse = await Promise.race([apiCallPromise, timeoutPromise]) as Response;

    if (!openAIResponse.ok) {
      let errorDetails = "Unknown API error";
      
      try {
        const errorData = await openAIResponse.json();
        errorDetails = errorData.error?.message || "Unknown API error";
      } catch (e) {
        errorDetails = "Could not parse error response";
      }
      
      console.error(`OpenAI transcription failed: ${errorDetails}`);
      return null;
    }

    const whisperEnd = Date.now();
    console.log(`OpenAI API responded in ${(whisperEnd - whisperStart) / 1000} seconds`);

    // Process the transcription data
    console.log("Processing transcription data");
    const transcriptionData = await openAIResponse.json();
    
    // Format the transcript with speaker detection if requested
    if (useSpeakerDetection && transcriptionData.segments) {
      return formatTranscriptWithSpeakers(transcriptionData);
    } else {
      return transcriptionData.text;
    }
  } catch (error) {
    console.error("Error in transcribeAudioBlob:", error);
    return null;
  }
}

/**
 * Transcribe a video file using OpenAI Whisper API
 */
async function transcribeVideoFile(videoData: Blob, useSpeakerDetection = false): Promise<string | null> {
  try {
    // Create form data for OpenAI API
    const formData = new FormData();
    formData.append('file', videoData, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Default to English
    
    // For speaker detection, we use the response_format 'verbose_json'
    if (useSpeakerDetection) {
      console.log("Enabling speaker detection with verbose_json format");
      formData.append('response_format', 'verbose_json');
    }
    
    // Call OpenAI's Whisper API for transcription
    console.log("Calling OpenAI Whisper API for transcription");
    
    const whisperStart = Date.now();
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API timeout after 40 seconds")), 40000);
    });
    
    // Make the API call with timeout
    const apiCallPromise = fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: formData
    });
    
    // Use Promise.race to implement timeout
    const openAIResponse = await Promise.race([apiCallPromise, timeoutPromise]) as Response;

    if (!openAIResponse.ok) {
      let errorDetails = "Unknown API error";
      
      try {
        const errorData = await openAIResponse.json();
        errorDetails = errorData.error?.message || "Unknown API error";
      } catch (e) {
        errorDetails = "Could not parse error response";
      }
      
      console.error(`OpenAI transcription failed: ${errorDetails}`);
      return null;
    }

    const whisperEnd = Date.now();
    console.log(`OpenAI API responded in ${(whisperEnd - whisperStart) / 1000} seconds`);

    // Process the transcription data
    console.log("Processing transcription data");
    const transcriptionData = await openAIResponse.json();
    
    // Format the transcript with speaker detection if requested
    if (useSpeakerDetection && transcriptionData.segments) {
      return formatTranscriptWithSpeakers(transcriptionData);
    } else {
      return transcriptionData.text;
    }
  } catch (error) {
    console.error("Error in transcribeVideoFile:", error);
    return null;
  }
}

/**
 * Format the transcript with speaker detection, timestamps, and line breaks
 */
function formatTranscriptWithSpeakers(transcriptionData) {
  if (!transcriptionData.segments || !Array.isArray(transcriptionData.segments)) {
    return transcriptionData.text;
  }
  
  let formattedText = '';
  let currentSpeaker = null;
  let speakerSegments = [];
  
  // First pass: collect segments by speaker and join related content
  for (const segment of transcriptionData.segments) {
    // Format timestamp
    const minutes = Math.floor(segment.start / 60);
    const seconds = Math.floor(segment.start % 60);
    const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Check if speaker has changed
    if (segment.speaker !== currentSpeaker) {
      if (speakerSegments.length > 0) {
        // Process previous speaker's segments
        formattedText += processSpeakerSegments(currentSpeaker, speakerSegments);
        speakerSegments = [];
      }
      
      // Start new speaker
      currentSpeaker = segment.speaker;
    }
    
    // Add segment to current speaker
    speakerSegments.push({
      text: segment.text,
      timestamp: timestamp
    });
  }
  
  // Process the last speaker's segments
  if (speakerSegments.length > 0) {
    formattedText += processSpeakerSegments(currentSpeaker, speakerSegments);
  }
  
  return formattedText.trim();
}

/**
 * Process segments from a single speaker
 */
function processSpeakerSegments(speaker, segments) {
  let text = `\n\nSpeaker ${speaker}: [${segments[0].timestamp}] `;
  
  // Join the segments with appropriate spacing
  segments.forEach((segment, index) => {
    // Only add timestamp for first segment or if there's a significant gap
    if (index > 0) {
      text += ' ' + segment.text;
    } else {
      text += segment.text;
    }
  });
  
  return text;
}

/**
 * Format a timestamp from seconds to MM:SS format
 */
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
