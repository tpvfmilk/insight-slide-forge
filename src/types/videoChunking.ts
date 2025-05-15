
/**
 * Types for video chunking functionality
 */

export interface ChunkMetadata {
  startTime: number;  // Start time in seconds
  endTime?: number;   // End time in seconds (optional for last chunk)
  index: number;      // Chunk index (0-based)
  videoPath?: string; // Path to the chunk video file (if stored separately)
  fileSize?: number;  // Size of this chunk in bytes
  title?: string;     // Optional title/description for the chunk
}

// For extending project or video metadata to include chunk information
export interface ChunkedVideoMetadata {
  chunks: ChunkMetadata[];
  totalDuration?: number;
  isChunked: boolean;
}

// Extend the existing video metadata structure
export interface ExtendedVideoMetadata {
  duration?: number;
  original_file_name?: string;
  file_type?: string;
  file_size?: number;
  chunking?: ChunkedVideoMetadata;
}
