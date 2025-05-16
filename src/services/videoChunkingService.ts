
import { supabase } from "@/integrations/supabase/client";
import { ChunkingInfo, ExtendedVideoMetadata, Json, ChunkMetadata } from "@/types/videoChunking";

// Define constants for chunking
export const MAX_CHUNK_SIZE_MB = 20; // Changed from 50MB to 20MB per requirement
export const MIN_CHUNK_DURATION = 30; // Minimum 30 seconds per chunk
export const MAX_CHUNK_DURATION = 300; // Maximum 5 minutes per chunk

/**
 * Analyzes a video file to determine if chunking is needed
 * @param videoFile The video file to analyze
 * @returns ExtendedVideoMetadata with basic info about the video
 */
export const analyzeVideoForChunking = async (videoFile: File): Promise<ExtendedVideoMetadata | null> => {
  try {
    // Basic video metadata extraction
    const metadata: ExtendedVideoMetadata = {
      original_file_name: videoFile.name,
      file_type: videoFile.type,
      file_size: videoFile.size,
    };
    
    // Use the HTML5 video element to get video duration if possible
    try {
      const url = URL.createObjectURL(videoFile);
      const video = document.createElement('video');
      
      video.preload = 'metadata';
      
      const durationPromise = new Promise<number>((resolve) => {
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve(video.duration);
        };
        
        // Set a timeout in case the metadata loading takes too long
        setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve(0); // Use 0 as a fallback duration
        }, 5000);
      });
      
      video.src = url;
      const duration = await durationPromise;
      
      metadata.duration = duration;
      console.log(`[DEBUG] Video duration: ${duration} seconds`);
    } catch (e) {
      console.warn('[DEBUG] Could not extract video duration:', e);
    }
    
    return metadata;
  } catch (error) {
    console.error('[DEBUG] Error analyzing video file:', error);
    return null;
  }
};

/**
 * Determines if a video needs to be chunked based on its size
 * @param fileSize The size of the video file in bytes
 * @returns boolean indicating if chunking is needed
 */
export const videoNeedsChunking = (fileSize: number): boolean => {
  // If file is larger than 50MB, it should be chunked
  return fileSize > MAX_CHUNK_SIZE_MB * 1024 * 1024;
};

/**
 * Gets an array of chunk start times from video metadata
 * @param metadata ExtendedVideoMetadata with chunking information
 * @returns Array of chunk start times in seconds
 */
export const getChunkTimemarks = (metadata: ExtendedVideoMetadata | null): number[] => {
  if (!metadata?.chunking?.chunks) {
    return [];
  }
  
  return metadata.chunking.chunks.map(chunk => chunk.startTime);
};

/**
 * Gets information about which chunk contains a specific time
 * @param currentTime Time in seconds
 * @param metadata ExtendedVideoMetadata with chunking information
 * @returns String with chunk information or null
 */
export const getChunkInfoAtTime = (currentTime: number, metadata: ExtendedVideoMetadata | null): string | null => {
  if (!metadata?.chunking?.chunks || metadata.chunking.chunks.length === 0) {
    return null;
  }
  
  // Find which chunk contains the current time
  const currentChunk = metadata.chunking.chunks.find(
    chunk => currentTime >= chunk.startTime && (!chunk.endTime || currentTime < chunk.endTime)
  );
  
  if (currentChunk) {
    return `Chunk ${currentChunk.index + 1} (${Math.floor(currentChunk.startTime / 60)}:${String(Math.floor(currentChunk.startTime % 60)).padStart(2, '0')} - ${currentChunk.endTime ? Math.floor(currentChunk.endTime / 60) : "?"}:${currentChunk.endTime ? String(Math.floor(currentChunk.endTime % 60)).padStart(2, '0') : "??"})`; 
  }
  
  return null;
};

/**
 * Gets detailed information about which chunk contains a specific time
 * @param currentTime Time in seconds
 * @param metadata ExtendedVideoMetadata with chunking information
 * @returns Object with chunk information or null
 */
export const getDetailedChunkInfoAtTime = (currentTime: number, metadata: ExtendedVideoMetadata | null): { chunkIndex: number; isInChunk: boolean; nextChunkTime: number } | null => {
  if (!metadata?.chunking?.chunks || metadata.chunking.chunks.length === 0) {
    return null;
  }
  
  // Find which chunk contains the current time
  const currentChunk = metadata.chunking.chunks.find(
    chunk => currentTime >= chunk.startTime && (!chunk.endTime || currentTime < chunk.endTime)
  );
  
  if (currentChunk) {
    // Find the next chunk's start time (if any)
    let nextChunkTime = Infinity;
    if (currentChunk.index < metadata.chunking.chunks.length - 1) {
      nextChunkTime = metadata.chunking.chunks[currentChunk.index + 1].startTime;
    } else if (currentChunk.endTime) {
      nextChunkTime = currentChunk.endTime;
    }
    
    return {
      chunkIndex: currentChunk.index,
      isInChunk: true,
      nextChunkTime
    };
  }
  
  // If we're not in any chunk, find the next upcoming chunk
  const sortedChunks = [...metadata.chunking.chunks].sort((a, b) => a.startTime - b.startTime);
  const nextChunk = sortedChunks.find(chunk => currentTime < chunk.startTime);
  
  if (nextChunk) {
    return {
      chunkIndex: -1,  // Not in a chunk
      isInChunk: false,
      nextChunkTime: nextChunk.startTime
    };
  }
  
  return null;
};

/**
 * Initiates server-side chunking process by calling the edge function
 * @param projectId The ID of the project
 * @param originalVideoPath The path to the original video in storage
 * @returns Promise with success status and optional error message
 */
export const initiateServerSideChunking = async (
  projectId: string, 
  originalVideoPath: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`[DEBUG] Initiating server-side chunking for project: ${projectId}`);
    
    // Get the current video metadata from the project
    const { data: project } = await supabase
      .from('projects')
      .select('video_metadata')
      .eq('id', projectId)
      .single();
      
    if (!project) {
      return { 
        success: false,
        error: "Project not found" 
      };
    }
    
    const videoMetadata = project.video_metadata as ExtendedVideoMetadata;
    
    // Prepare chunking info if it doesn't exist
    const chunkingInfo: ChunkingInfo = videoMetadata?.chunking || {
      isChunked: true,
      chunks: [],
      status: "pending",
      totalDuration: videoMetadata?.duration || 0
    };
    
    // Call the edge function to perform chunking
    const response = await supabase.functions.invoke('video-chunker', {
      body: {
        projectId,
        originalVideoPath,
        chunkingMetadata: chunkingInfo
      }
    });
    
    if (response.error) {
      console.error("[DEBUG] Edge function error:", response.error);
      return {
        success: false,
        error: `Edge function error: ${response.error.message || response.error}`
      };
    }
    
    const result = response.data;
    console.log("[DEBUG] Chunking result:", result);
    
    if (!result || result.error) {
      return {
        success: false,
        error: result?.error || "Unknown error during chunking"
      };
    }
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error("[DEBUG] Error initiating server-side chunking:", error);
    return {
      success: false,
      error: error.message || "Unknown error during chunking"
    };
  }
};

/**
 * Force updates the chunking metadata for a project
 * @param projectId The ID of the project
 * @returns Promise with success status and optional error message
 */
export const forceUpdateChunkingMetadata = async (projectId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get current project data
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (!project) {
      return { 
        success: false,
        error: "Project not found" 
      };
    }
    
    const videoMetadata = project.video_metadata as ExtendedVideoMetadata;
    
    if (!videoMetadata) {
      return { 
        success: false,
        error: "No video metadata found" 
      };
    }
    
    // Update the chunking flag
    videoMetadata.chunking = {
      isChunked: true,
      totalDuration: videoMetadata.duration || 0,
      chunks: [],
      status: "prepared"
    };
    
    // Update the project
    const { error } = await supabase
      .from('projects')
      .update({ 
        video_metadata: videoMetadata as Json
      })
      .eq('id', projectId);
      
    if (error) {
      console.error("[DEBUG] Error updating chunking metadata:", error);
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error("[DEBUG] Error forcing chunking metadata update:", error);
    return {
      success: false,
      error: error.message || "Unknown error updating metadata"
    };
  }
};
