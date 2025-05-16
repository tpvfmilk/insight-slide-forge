/**
 * Extract audio from a video file using HTML5 and Web Audio API
 * @param videoFile The video file to extract audio from
 * @returns Promise with the extracted audio blob
 */
export const extractAudioFromVideoFile = async (videoFile: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Create video and canvas elements
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }
    
    // Set up audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    
    // Handle video loaded metadata
    video.onloadedmetadata = () => {
      // Set video to start at beginning
      video.currentTime = 0;
      
      // Set up canvas size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Process video
      video.muted = false; // We need audio
      
      // Connect audio output to destination
      const audioSource = audioCtx.createMediaElementSource(video);
      audioSource.connect(dest);
      audioSource.connect(audioCtx.destination);
      
      // Create a media recorder
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(dest.stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/mp3' });
        resolve(blob);
        
        // Clean up
        video.pause();
        video.src = '';
        URL.revokeObjectURL(video.src);
      };
      
      // Start recording and playing
      recorder.start();
      video.play().catch(error => {
        console.error("Error playing video:", error);
        recorder.stop();
        reject(error);
      });
      
      // Stop recording when video ends
      video.onended = () => {
        recorder.stop();
      };
      
      // Handle errors
      video.onerror = (error) => {
        console.error("Video error:", error);
        recorder.stop();
        reject(error);
      };
    };
    
    // Load the video
    video.src = URL.createObjectURL(videoFile);
    
    // Set a timeout in case the video doesn't load
    const timeout = setTimeout(() => {
      reject(new Error("Timeout extracting audio from video"));
    }, 60000); // 60 second timeout
    
    video.onended = () => {
      clearTimeout(timeout);
    };
  });
};

import { supabase } from "@/integrations/supabase/client";
import { AudioChunkMetadata } from "@/services/audioChunkingService";

/**
 * Extract audio, chunk it, and return chunk metadata
 * @param videoFile The video file to process
 * @param projectId Project ID for storage path
 * @param options Options for chunking
 * @param progressCallback Optional callback for tracking progress
 * @returns Promise with array of chunk metadata
 */
export const extractAndChunkAudio = async (
  videoFile: File,
  projectId: string,
  options = {
    maxChunkDuration: 60,
    maxChunkSizeMB: 20,
    format: 'wav',
    quality: 'medium'
  },
  progressCallback?: (progress: number, stage: string) => void
) => {
  try {
    if (progressCallback) progressCallback(5, "Extracting audio from video");
    
    // Extract audio from the video file
    const audioBlob = await extractAudioFromVideoFile(videoFile);
    
    if (progressCallback) progressCallback(15, "Audio extracted");
    
    // Chunk the audio file
    // (We'll assume chunkAudioFile function exists and works as expected)
    // You may need to adjust the parameters based on your requirements
    const chunkingResult = await import("@/services/audioChunkingService").then(m => m.chunkAudioFile(
      audioBlob,
      options.maxChunkDuration,
      options.maxChunkSizeMB,
      (progress) => {
        if (progressCallback) progressCallback(15 + progress * 0.3, "Chunking audio"); // Up to 45%
      }
    ));
    
    if (!chunkingResult.success) {
      return {
        success: false,
        chunks: [],
        error: chunkingResult.error
      };
    }
    
    if (progressCallback) progressCallback(50, "Audio chunked");
    
    return {
      success: true,
      chunks: chunkingResult.chunks
    };
  } catch (error: any) {
    console.error("Error extracting and chunking audio:", error);
    return {
      success: false,
      chunks: [],
      error: error.message
    };
  }
};

/**
 * Transcribe audio chunks using serverless function
 * @param projectId Project ID for storage path
 * @param chunks Array of audio chunk metadata
 * @param progressCallback Optional callback for tracking progress
 * @returns Promise with transcription result
 */
export const transcribeAudioChunks = async (
  projectId: string,
  chunks: AudioChunkMetadata[],
  progressCallback?: (progress: number) => void
) => {
  try {
    if (!chunks || chunks.length === 0) {
      console.warn("No audio chunks to transcribe");
      return {
        success: true,
        transcript: ""
      };
    }
    
    let combinedTranscript = "";
    let completedChunks = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Call the serverless function to transcribe the chunk
      const { data, error } = await supabase.functions.invoke('transcribe-audio-chunk', {
        body: {
          projectId: projectId,
          audioPath: chunk.audioPath,
          chunkIndex: chunk.index
        }
      });
      
      if (error) {
        console.error(`Error transcribing chunk ${chunk.index}:`, error);
        return {
          success: false,
          transcript: "",
          error: error.message
        };
      }
      
      // Append the transcribed text to the combined transcript
      combinedTranscript += data.text + " ";
      completedChunks++;
      
      // Update progress
      if (progressCallback) {
        const progress = (completedChunks / chunks.length) * 100;
        progressCallback(progress);
      }
    }
    
    return {
      success: true,
      transcript: combinedTranscript
    };
  } catch (error: any) {
    console.error("Error transcribing audio chunks:", error);
    return {
      success: false,
      transcript: "",
      error: error.message
    };
  }
};
