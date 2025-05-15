
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Size of each chunk in bytes (20MB)
export const CHUNK_SIZE = 20 * 1024 * 1024;

/**
 * Metadata for a video chunk
 */
export interface VideoChunk {
  index: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  chunkPath: string;
  size: number; // in bytes
}

/**
 * Metadata for a chunked video
 */
export interface ChunkedVideoMetadata {
  originalFileName: string;
  originalFileSize: number;
  originalDuration: number; // in seconds
  mimeType: string;
  chunks: VideoChunk[];
  isChunked: boolean;
}

/**
 * Splits a video file into chunks of specified size
 * @param file The video file to split
 * @param projectId The project ID
 * @param onProgress Progress callback function
 * @returns Promise resolving to chunked video metadata
 */
export const chunkVideoFile = async (
  file: File, 
  projectId: string,
  onProgress?: (progress: number) => void
): Promise<ChunkedVideoMetadata> => {
  try {
    // Check if file is too small to chunk
    if (file.size <= CHUNK_SIZE) {
      // Return metadata without chunking
      const videoDuration = await getVideoDuration(file);
      return {
        originalFileName: file.name,
        originalFileSize: file.size,
        originalDuration: videoDuration,
        mimeType: file.type,
        chunks: [],
        isChunked: false
      };
    }
    
    // Get video duration for timestamp calculation
    const videoDuration = await getVideoDuration(file);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    console.log(`Chunking ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) into ${totalChunks} chunks of ${(CHUNK_SIZE / 1024 / 1024).toFixed(2)}MB each`);
    
    const chunks: VideoChunk[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min((i + 1) * CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end, file.type);
      const chunkFile = new File([chunkBlob], `chunk_${i}_${file.name}`);
      
      // Calculate approximate start and end times based on file position
      const startTime = (start / file.size) * videoDuration;
      const endTime = (end / file.size) * videoDuration;
      
      // Create a path for this chunk
      const chunkPath = `chunked_videos/${projectId}/${Date.now()}_chunk_${i}_${file.name}`;

      // Upload the chunk
      const { error: uploadError } = await supabase.storage
        .from('video_uploads')
        .upload(chunkPath, chunkFile, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) {
        console.error(`Error uploading chunk ${i}:`, uploadError);
        throw new Error(`Failed to upload chunk ${i}: ${uploadError.message}`);
      }
      
      // Add chunk metadata
      chunks.push({
        index: i,
        startTime,
        endTime,
        chunkPath,
        size: chunkFile.size
      });
      
      // Report progress
      if (onProgress) {
        onProgress((i + 1) / totalChunks * 100);
      }
    }
    
    // Return metadata for all chunks
    return {
      originalFileName: file.name,
      originalFileSize: file.size,
      originalDuration: videoDuration,
      mimeType: file.type,
      chunks,
      isChunked: true
    };
  } catch (error) {
    console.error("Error chunking video:", error);
    toast.error("Failed to process video chunks");
    throw error;
  }
};

/**
 * Gets the duration of a video file
 * @param file The video file
 * @returns Promise resolving to duration in seconds
 */
export const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    
    video.onerror = () => {
      resolve(0); // Return 0 if we can't get the duration
    };
    
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Retrieves signed URLs for all chunks of a video
 * @param chunks Array of video chunks
 * @returns Promise resolving to array of signed URLs
 */
export const getChunkSignedUrls = async (chunks: VideoChunk[]): Promise<string[]> => {
  try {
    const urls: string[] = [];
    
    for (const chunk of chunks) {
      const { data, error } = await supabase.storage
        .from('video_uploads')
        .createSignedUrl(chunk.chunkPath, 7200); // 2-hour expiry
        
      if (error || !data?.signedUrl) {
        console.error("Error getting signed URL for chunk:", error);
        throw error;
      }
      
      urls.push(data.signedUrl);
    }
    
    return urls;
  } catch (error) {
    console.error("Error getting chunk URLs:", error);
    throw error;
  }
};

/**
 * Deletes all chunks for a video
 * @param chunks Array of video chunks to delete
 */
export const deleteVideoChunks = async (chunks: VideoChunk[]): Promise<void> => {
  try {
    const chunkPaths = chunks.map(chunk => chunk.chunkPath);
    
    if (chunkPaths.length > 0) {
      const { error } = await supabase.storage
        .from('video_uploads')
        .remove(chunkPaths);
        
      if (error) {
        console.error("Error deleting chunks:", error);
      }
    }
  } catch (error) {
    console.error("Error in deleteVideoChunks:", error);
  }
};
