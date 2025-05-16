
import { supabase } from "@/integrations/supabase/client";
import { ChunkMetadata, ExtendedVideoMetadata } from "@/types/videoChunking";

// Chunking constants
export const MAX_CHUNK_SIZE_MB = 25; // Maximum size for a video chunk in MB
export const MIN_CHUNK_DURATION = 30; // Minimum duration for a chunk in seconds
export const MAX_CHUNK_DURATION = 600; // Maximum duration for a chunk in seconds (10 minutes)

/**
 * Updates the metadata for a project to flag it for chunking
 * @param projectId The ID of the project to update
 * @returns A result object indicating success or error
 */
export const forceUpdateChunkingMetadata = async (
  projectId: string,
  transcriptionProvider: 'openai' | 'google' = 'openai'
): Promise<{ success: boolean, error?: string }> => {
  try {
    // Get the current project data
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('video_metadata')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      return { success: false, error: projectError.message };
    }

    if (!projectData) {
      return { success: false, error: "Project not found" };
    }

    // Update the video metadata to indicate chunking is needed
    // Fix: Explicitly check if video_metadata is an object and use a type assertion
    const currentMetadata = projectData.video_metadata || {};
    const newMetadata = {
      ...currentMetadata,
      chunking: {
        isChunked: true,
        isVirtualChunking: true,  // Set to true for client-side chunking
        status: 'pending',
        chunks: [],
        createdAt: new Date().toISOString(),
        transcriptionProvider: transcriptionProvider
      }
    };

    // Update the database with the new metadata
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        video_metadata: newMetadata
      })
      .eq('id', projectId);

    if (updateError) {
      console.error("Error updating project metadata:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in forceUpdateChunkingMetadata:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Extract chunk timemarks from video metadata
 * @param metadata Video metadata containing chunk information
 * @returns Array of timemarks (start times) for each chunk
 */
export const getChunkTimemarks = (metadata: ExtendedVideoMetadata | null): number[] => {
  if (!metadata || !metadata.chunking || !metadata.chunking.chunks) {
    return [];
  }
  
  // Extract and return the start time of each chunk
  return metadata.chunking.chunks.map(chunk => chunk.startTime);
};

/**
 * Gets a string representation of chunk info at a specific timestamp
 * @param time Current playback time in seconds
 * @param metadata Video metadata containing chunk information
 * @returns String representation of chunk info or null if not found
 */
export const getChunkInfoAtTime = (time: number, metadata: ExtendedVideoMetadata | null): string | null => {
  if (!metadata || !metadata.chunking || !metadata.chunking.chunks) {
    return null;
  }
  
  // Find the chunk that contains the current time
  const chunk = metadata.chunking.chunks.find(c => 
    time >= c.startTime && time < c.endTime
  );
  
  if (!chunk) {
    return null;
  }
  
  return `Chunk ${chunk.index + 1} (${formatDuration(chunk.startTime)} - ${formatDuration(chunk.endTime)})`;
};

/**
 * Gets detailed chunk information at a specific timestamp
 * @param time Current playback time in seconds
 * @param metadata Video metadata containing chunk information
 * @returns Detailed chunk info object or null if not found
 */
export const getDetailedChunkInfoAtTime = (
  time: number, 
  metadata: ExtendedVideoMetadata | null
): { 
  chunkIndex: number; 
  isInChunk: boolean; 
  nextChunkTime: number 
} | null => {
  if (!metadata || !metadata.chunking || !metadata.chunking.chunks) {
    return null;
  }
  
  // Find the chunk that contains the current time
  const chunkIndex = metadata.chunking.chunks.findIndex(c => 
    time >= c.startTime && time < c.endTime
  );
  
  if (chunkIndex === -1) {
    // If not in any chunk, find the next chunk start time
    const futureChunks = metadata.chunking.chunks
      .filter(c => c.startTime > time)
      .sort((a, b) => a.startTime - b.startTime);
    
    const nextChunkTime = futureChunks.length > 0 ? futureChunks[0].startTime : -1;
    
    return {
      chunkIndex: -1,
      isInChunk: false,
      nextChunkTime
    };
  }
  
  // Return detailed info about the current chunk
  return {
    chunkIndex,
    isInChunk: true,
    nextChunkTime: metadata.chunking.chunks[chunkIndex].endTime
  };
};

/**
 * Helper function to format time in MM:SS format
 * @param seconds Time in seconds
 * @returns Formatted time string
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};
