
/**
 * Extended metadata about a video with chunking information
 */
export interface ExtendedVideoMetadata {
  duration?: number;
  original_file_name?: string;
  file_type?: string;
  file_size?: number;
  chunking?: ChunkingInfo;
}

/**
 * Information about video chunking
 */
export interface ChunkingInfo {
  isChunked: boolean;
  totalDuration?: number;
  chunks: ChunkMetadata[];
}

/**
 * Metadata about a specific video chunk
 */
export interface ChunkMetadata {
  index: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  videoPath: string;
  title?: string;
}
