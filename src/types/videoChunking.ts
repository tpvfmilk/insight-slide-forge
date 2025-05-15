
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
  chunks: ChunkMetadata[] | JsonSafeChunkMetadata[];
  status?: "prepared" | "processing" | "complete" | "error"; // Status of the chunking process
  processedAt?: string; // Timestamp when chunking was completed
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
  status?: "pending" | "processing" | "complete" | "error"; // Status of chunk processing
}

/**
 * Type to ensure JSON compatibility when storing in the database
 * Note: This type ensures all objects are JSON serializable
 */
export type JsonSafeChunkMetadata = {
  index: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  videoPath: string;
  title?: string;
  status?: string;
};

/**
 * Type for JSON-safe extended video metadata for database storage
 */
export interface JsonSafeVideoMetadata {
  duration?: number;
  original_file_name?: string;
  file_type?: string;
  file_size?: number;
  chunking?: {
    isChunked: boolean;
    totalDuration?: number;
    chunks: JsonSafeChunkMetadata[];
    status?: string;
    processedAt?: string;
  };
}

/**
 * Json compatible type for Supabase storage
 */
export type Json = 
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
