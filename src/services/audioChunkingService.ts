
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MAX_CHUNK_SIZE_MB } from "./videoChunkingService";

export interface AudioChunkMetadata {
  index: number;
  startTime: number;
  endTime?: number;
  duration: number;
  audioPath: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  text?: string;
}

export interface AudioExtractionOptions {
  maxChunkDuration: number;
  maxChunkSizeMB: number;
  format: 'mp3' | 'wav' | 'ogg';
  quality: 'low' | 'medium' | 'high';
}

// In browser environments, we can't actually chunk audio directly
// This is a helper function to simulate audio chunking for frontend visualization
export const createVirtualChunks = (
  totalDuration: number,
  options: AudioExtractionOptions
): AudioChunkMetadata[] => {
  const chunks: AudioChunkMetadata[] = [];
  let startTime = 0;
  let chunkIndex = 0;
  
  while (startTime < totalDuration) {
    const chunkDuration = Math.min(options.maxChunkDuration, totalDuration - startTime);
    if (chunkDuration <= 0) break;
    
    const endTime = startTime + chunkDuration;
    
    chunks.push({
      index: chunkIndex,
      startTime,
      endTime,
      duration: chunkDuration,
      audioPath: `chunk_${chunkIndex}.${options.format}`,
      status: 'pending'
    });
    
    startTime = endTime;
    chunkIndex++;
  }
  
  return chunks;
};

// This function calls the edge function to extract audio and chunk it
export const extractAndChunkAudio = async (
  videoFile: File,
  projectId: string,
  options: AudioExtractionOptions,
  onProgress?: (progress: number, stage: string) => void
): Promise<{ 
  success: boolean; 
  chunks?: AudioChunkMetadata[]; 
  error?: string;
}> => {
  try {
    if (onProgress) onProgress(10, "Preparing audio extraction");
    
    // Get video duration
    const videoDuration = await getVideoDuration(videoFile);
    
    if (onProgress) onProgress(20, "Preparing audio chunks");
    
    // Create virtual chunks based on duration
    const chunks = createVirtualChunks(videoDuration, options);
    
    if (onProgress) onProgress(30, "Starting server-side audio processing");
    
    // Call edge function to actually process the audio
    const { data, error } = await supabase.functions.invoke("extract-audio", {
      body: {
        projectId,
        originalFileName: videoFile.name,
        totalDuration: videoDuration,
        chunkingOptions: options,
        fileSize: videoFile.size,
      }
    });
    
    if (error) {
      console.error("[DEBUG] Error extracting audio:", error);
      return { success: false, error: error.message };
    }
    
    if (!data || !data.success) {
      return { 
        success: false, 
        error: data?.error || "Unknown error extracting audio"
      };
    }
    
    if (onProgress) onProgress(90, "Audio processing complete");
    
    // Update chunks with server data if available
    const serverChunks = data.chunks || chunks;
    
    return { success: true, chunks: serverChunks };
  } catch (error: any) {
    console.error("[DEBUG] Error in extractAndChunkAudio:", error);
    return { success: false, error: error.message };
  }
};

// Helper function to get video duration
const getVideoDuration = async (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    
    video.onerror = () => {
      // Fallback to estimating duration based on file size
      // Assuming roughly 500 KB/s for a medium quality video
      const estimatedDurationSecs = file.size / (500 * 1024);
      resolve(estimatedDurationSecs);
    };
    
    video.src = URL.createObjectURL(file);
    
    // Fallback timeout
    setTimeout(() => {
      const estimatedDurationSecs = file.size / (500 * 1024);
      resolve(estimatedDurationSecs);
    }, 5000);
  });
};

// Function to transcribe audio chunks
export const transcribeAudioChunks = async (
  projectId: string,
  chunks: AudioChunkMetadata[],
  onProgress?: (progress: number) => void
): Promise<{
  success: boolean;
  transcript?: string;
  error?: string;
}> => {
  try {
    if (!chunks || chunks.length === 0) {
      return { success: false, error: "No audio chunks to transcribe" };
    }
    
    // Call our edge function to transcribe the chunks
    const { data, error } = await supabase.functions.invoke("transcribe-audio-chunks", {
      body: {
        projectId,
        chunks,
      }
    });
    
    if (error) {
      console.error("[DEBUG] Error transcribing audio chunks:", error);
      return { success: false, error: error.message };
    }
    
    if (!data || !data.success) {
      return { 
        success: false, 
        error: data?.error || "Unknown error transcribing audio chunks"
      };
    }
    
    return { 
      success: true, 
      transcript: data.transcript 
    };
  } catch (error: any) {
    console.error("[DEBUG] Error in transcribeAudioChunks:", error);
    return { success: false, error: error.message };
  }
};
