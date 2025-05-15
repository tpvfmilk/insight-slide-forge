
import { ExtendedVideoMetadata, ChunkMetadata } from "@/types/videoChunking";
import { ProjectVideo } from "@/services/projectVideoService";
import { Project } from "@/services/projectService";

/**
 * Extracts chunk timemarks from project or video metadata
 * @param metadata Video metadata that may contain chunk information
 * @returns Array of chunk start times in seconds, or empty array if no chunks
 */
export const getChunkTimemarks = (metadata: ExtendedVideoMetadata | null | undefined): number[] => {
  if (!metadata?.chunking?.chunks || !metadata.chunking.isChunked) {
    return [];
  }
  
  // Sort chunks by start time to ensure proper ordering
  const sortedChunks = [...metadata.chunking.chunks].sort((a, b) => a.startTime - b.startTime);
  
  // Extract start times from each chunk (except for the first one which is always 0)
  // The first chunk typically starts at 0, so we skip it to avoid redundant marker
  return sortedChunks
    .slice(1) // Skip the first chunk which starts at 0
    .map(chunk => chunk.startTime);
};

/**
 * Formats chunk information for display in tooltips
 * @param time Current time in seconds
 * @param metadata Video metadata with chunk information
 * @returns Formatted string with chunk details or null if not in a chunk
 */
export const getChunkInfoAtTime = (
  time: number, 
  metadata: ExtendedVideoMetadata | null | undefined
): string | null => {
  if (!metadata?.chunking?.chunks || !metadata.chunking.isChunked) {
    return null;
  }
  
  // Find the chunk that contains this time
  const chunk = metadata.chunking.chunks.find(
    c => time >= c.startTime && (!c.endTime || time < c.endTime)
  );
  
  if (!chunk) return null;
  
  return `Chunk ${chunk.index + 1}${chunk.title ? `: ${chunk.title}` : ''}`;
};

/**
 * Gets chunk information from project data
 * @param project Project data that may contain chunked video metadata
 * @returns Array of chunk start times in seconds
 */
export const getChunkTimemarksFromProject = (project: Project | null): number[] => {
  if (!project?.video_metadata) return [];
  return getChunkTimemarks(project.video_metadata as ExtendedVideoMetadata);
};

/**
 * Gets chunk information from project video data
 * @param video ProjectVideo data that may contain chunked video metadata
 * @returns Array of chunk start times in seconds
 */
export const getChunkTimemarksFromVideo = (video: ProjectVideo | null): number[] => {
  if (!video?.video_metadata) return [];
  return getChunkTimemarks(video.video_metadata as ExtendedVideoMetadata);
};
