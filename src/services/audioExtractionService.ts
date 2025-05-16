
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Service for handling audio extraction from videos
 * This implementation extracts audio from video files in the browser
 */

/**
 * Extract audio from a video file using the Web Audio API
 * @param videoFile File object of the video to extract audio from
 * @param progressCallback Optional callback function for tracking extraction progress
 * @returns Promise with the extracted audio as a Blob
 */
export const extractAudioFromVideo = async (
  videoFile: File,
  progressCallback?: (progress: number) => void
): Promise<Blob> => {
  try {
    // Create a URL for the video file
    const videoURL = URL.createObjectURL(videoFile);
    
    // Set up audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create video element to extract audio from
    const video = document.createElement('video');
    
    // Create a promise that resolves when the video metadata is loaded
    const metadataLoaded = new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });
    
    // Set video source
    video.src = videoURL;
    video.crossOrigin = "anonymous";
    
    // Wait for metadata to be loaded
    await metadataLoaded;
    
    // Set video to the beginning
    video.currentTime = 0;
    
    // Create media recorder to capture audio
    const videoTotalTime = video.duration;
    
    // Create source and destination nodes
    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    
    // Also connect to audio output if needed
    source.connect(audioContext.destination);
    
    // Set up media recorder
    const mediaRecorder = new MediaRecorder(destination.stream);
    const audioChunks: BlobPart[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    // Create a promise that resolves when recording is stopped
    const recordingFinished = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        URL.revokeObjectURL(videoURL); // Clean up
        resolve(audioBlob);
      };
    });
    
    // Start recording and playing
    mediaRecorder.start();
    video.play();
    
    // Set up progress tracking
    if (progressCallback) {
      const progressInterval = setInterval(() => {
        if (video.currentTime > 0) {
          const progress = Math.min((video.currentTime / videoTotalTime) * 100, 100);
          progressCallback(progress);
        }
        
        if (video.ended || progress === 100) {
          clearInterval(progressInterval);
        }
      }, 500);
    }
    
    // Wait for video to finish playing
    const playbackFinished = new Promise<void>((resolve) => {
      video.onended = () => {
        mediaRecorder.stop();
        resolve();
      };
    });
    
    await playbackFinished;
    const audioBlob = await recordingFinished;
    
    // Clean up
    video.remove();
    await audioContext.close();
    
    // Return the audio blob
    return audioBlob;
  } catch (error) {
    console.error("Error extracting audio:", error);
    toast.error(`Audio extraction failed: ${error.message || "Unknown error"}`);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
};

/**
 * Process multiple video chunks to extract audio from them
 * @param projectId Project ID
 * @param chunks Array of chunk metadata
 * @returns Promise with information about the extraction process
 */
export const batchExtractAudio = async (
  projectId: string,
  chunks: Array<{ 
    videoPath: string; 
    index: number; 
    startTime: number; 
    endTime?: number;
  }>
): Promise<{
  success: boolean;
  processedCount: number;
  failedCount: number;
  audioPaths: string[];
}> => {
  // This function would handle batch processing but we're updating it to be a placeholder
  // until we implement the full production version
  console.warn("Batch audio extraction is only available in production implementation");
  
  return {
    success: false,
    processedCount: 0,
    failedCount: chunks.length,
    audioPaths: []
  };
};

// This is a placeholder function meant to be replaced with the real implementation
// in the production environment. For now, it returns a mock response.
export const serverExtractAudioFromVideo = async (
  videoPath: string,
  projectId: string,
  options: {
    chunkIndex?: number;
    format?: 'mp3' | 'wav' | 'aac';
    quality?: 'low' | 'medium' | 'high';
  } = {}
): Promise<{ success: boolean; audioPath?: string; error?: string }> => {
  try {
    const {
      chunkIndex = 0,
      format = 'mp3',
      quality = 'medium'
    } = options;
    
    // This is where we'd call our dedicated FFmpeg service in production
    // For now, we'll call the edge function placeholder
    const response = await supabase.functions.invoke('extract-audio', {
      body: {
        videoPath,
        projectId,
        chunkIndex,
        format,
        quality
      }
    });
    
    if (response.error) {
      throw new Error(`Audio extraction service error: ${response.error.message}`);
    }
    
    const result = response.data;
    
    // Check if we got a proper response
    if (!result.success) {
      console.warn("Audio extraction placeholder called successfully but returned failure status");
      
      // Show a toast explaining the implementation needed for production
      toast.info(
        "Audio extraction requires FFmpeg which is not available in Edge Functions. " +
        "For production, implement a dedicated server with FFmpeg."
      );
      
      return {
        success: false,
        error: "Audio extraction requires production implementation with FFmpeg"
      };
    }
    
    // In a real implementation, we'd return the path to the extracted audio
    return {
      success: true,
      audioPath: `audio_extracts/${projectId}/chunk_${chunkIndex}.${format}`,
    };
  } catch (error) {
    console.error("Error in audio extraction service:", error);
    
    return {
      success: false,
      error: error.message
    };
  }
};
