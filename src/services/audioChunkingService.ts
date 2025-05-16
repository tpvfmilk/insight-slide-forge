
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const MAX_CHUNK_SIZE_MB = 20; // 20 MB maximum size per chunk

// Audio chunk type definition
export interface AudioChunk {
  blob: Blob;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
}

// Type for audio chunk metadata (without the binary data)
export interface AudioChunkMetadata {
  index: number;
  startTime: number;
  endTime?: number;
  duration: number;
  audioPath: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  text?: string;
}

/**
 * Chunk an audio file into smaller pieces for processing
 * @param audioBlob The full audio blob to chunk
 * @param maxChunkDurationSecs Maximum duration of each chunk in seconds
 * @param maxChunkSizeMB Maximum size of each chunk in MB
 * @param progressCallback Optional callback for tracking chunking progress
 * @returns Promise with array of chunk metadata
 */
export const chunkAudioFile = async (
  audioBlob: Blob,
  maxChunkDurationSecs: number = 60,
  maxChunkSizeMB: number = MAX_CHUNK_SIZE_MB,
  progressCallback?: (progress: number) => void
): Promise<{
  success: boolean;
  chunks: AudioChunkMetadata[];
  originalDuration: number;
  error?: string;
}> => {
  try {
    // Create an audio element to get duration
    const audioElement = document.createElement('audio');
    audioElement.src = URL.createObjectURL(audioBlob);
    
    // Wait for metadata to load
    await new Promise<void>((resolve) => {
      audioElement.addEventListener('loadedmetadata', () => {
        resolve();
      });
      
      // Fallback if metadata doesn't load
      setTimeout(() => {
        resolve();
      }, 3000);
    });
    
    // Get audio duration (in seconds)
    const duration = audioElement.duration || 0;
    
    console.log(`Audio duration: ${duration} seconds, size: ${audioBlob.size / (1024 * 1024)} MB`);
    
    if (duration === 0) {
      throw new Error("Failed to determine audio duration");
    }
    
    // Release the object URL
    URL.revokeObjectURL(audioElement.src);
    
    // Calculate bytes per second (rough estimation)
    const bytesPerSecond = audioBlob.size / duration;
    
    // Calculate optimal chunk duration to stay under maxChunkSizeMB
    // But don't exceed maxChunkDurationSecs
    const optimalChunkDuration = Math.min(
      maxChunkDurationSecs,
      (maxChunkSizeMB * 1024 * 1024) / bytesPerSecond
    );
    
    console.log(`Optimal chunk duration: ${optimalChunkDuration} seconds`);
    
    // Calculate number of chunks needed
    const numChunks = Math.ceil(duration / optimalChunkDuration);
    const chunks: AudioChunkMetadata[] = [];
    
    let startTime = 0;
    
    for (let i = 0; i < numChunks; i++) {
      // For the last chunk, make sure we don't exceed the total duration
      const chunkDuration = Math.min(optimalChunkDuration, duration - startTime);
      if (chunkDuration <= 0) break;
      
      const endTime = startTime + chunkDuration;
      
      // Add chunk metadata without the blob (we'll generate chunks on demand later)
      chunks.push({
        index: i,
        startTime,
        endTime,
        duration: chunkDuration,
        audioPath: `chunk_${i}.mp3`, // Placeholder path
        status: 'pending'
      });
      
      startTime = endTime;
      
      // Update progress if callback provided
      if (progressCallback) {
        const progress = ((i + 1) / numChunks) * 100;
        progressCallback(progress);
      }
    }
    
    console.log(`Created ${chunks.length} audio chunk metadata entries`);
    
    return {
      success: true,
      chunks,
      originalDuration: duration
    };
  } catch (error: any) {
    console.error("Error chunking audio:", error);
    return {
      success: false,
      chunks: [],
      originalDuration: 0,
      error: error.message
    };
  }
};

/**
 * Upload audio chunks to storage
 * @param projectId Project ID for storage path
 * @param chunks Array of audio chunks to upload
 * @param progressCallback Optional callback for tracking upload progress
 * @returns Promise with array of updated chunk metadata
 */
export const uploadAudioChunks = async (
  projectId: string,
  chunks: AudioChunk[],
  progressCallback?: (progress: number) => void
): Promise<AudioChunkMetadata[]> => {
  const uploadedChunks: AudioChunkMetadata[] = [];
  let totalUploaded = 0;
  
  if (!chunks.length) {
    console.warn("No chunks to upload");
    return [];
  }
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      // Format the file path for this chunk
      const fileName = `chunk_${chunk.index}_${Date.now()}.mp3`;
      const filePath = `projects/${projectId}/audio_chunks/${fileName}`;
      
      // Upload the chunk to storage
      const { data, error } = await supabase.storage
        .from('audio_chunks')
        .upload(filePath, chunk.blob, {
          contentType: 'audio/mp3',
          upsert: true
        });
        
      if (error) {
        console.error(`Error uploading chunk ${chunk.index}:`, error);
        uploadedChunks.push({
          index: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          duration: chunk.duration,
          audioPath: "", // No path since upload failed
          status: 'failed'
        });
      } else {
        uploadedChunks.push({
          index: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          duration: chunk.duration,
          audioPath: filePath,
          status: 'complete'
        });
      }
      
      // Update progress
      totalUploaded++;
      if (progressCallback) {
        const progress = (totalUploaded / chunks.length) * 100;
        progressCallback(progress);
      }
      
    } catch (error) {
      console.error(`Error processing chunk ${chunk.index}:`, error);
      uploadedChunks.push({
        index: chunk.index,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        duration: chunk.duration,
        audioPath: "", // No path since processing failed
        status: 'failed'
      });
    }
  }
  
  return uploadedChunks;
};
