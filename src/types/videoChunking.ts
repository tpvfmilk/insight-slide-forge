
/**
 * Extended metadata about a video with chunking information
 */
export interface ExtendedVideoMetadata {
  duration?: number;
  original_file_name?: string;
  file_type?: string;
  file_size?: number;
  chunking?: ChunkingInfo;
  [key: string]: any; // Index signature for Json compatibility
}

/**
 * Information about video chunking
 */
export interface ChunkingInfo {
  isChunked: boolean;
  totalDuration?: number;
  chunks: ChunkMetadata[] | JsonSafeChunkMetadata[];
  status?: "pending" | "prepared" | "processing" | "complete" | "error"; // Extended status options
  processedAt?: string; // Timestamp when chunking was completed
  error?: string; // Error message if chunking failed
  [key: string]: any; // Index signature for Json compatibility
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
  error?: string; // Error message if chunk processing failed
  [key: string]: any; // Index signature for Json compatibility
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
  error?: string;
  [key: string]: any; // Index signature for Json compatibility
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
    error?: string;
    [key: string]: any; // Index signature for Json compatibility
  };
  [key: string]: any; // Index signature for Json compatibility
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

/**
 * Helper function to convert ExtendedVideoMetadata to JsonSafeVideoMetadata
 */
export function toJsonSafe(metadata: ExtendedVideoMetadata): Json {
  try {
    const jsonSafeMetadata: Record<string, Json> = {
      duration: metadata.duration,
      original_file_name: metadata.original_file_name,
      file_type: metadata.file_type,
      file_size: metadata.file_size
    };
    
    if (metadata.chunking) {
      // Convert chunks to JSON-safe format
      const jsonSafeChunks: JsonSafeChunkMetadata[] = [];
      
      // Safely convert each chunk regardless of its original type
      if (Array.isArray(metadata.chunking.chunks)) {
        metadata.chunking.chunks.forEach((chunk) => {
          const safeChunk: JsonSafeChunkMetadata = {
            index: chunk.index,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            duration: chunk.duration,
            videoPath: chunk.videoPath,
            title: chunk.title || `Chunk ${chunk.index + 1}`,
            status: chunk.status || 'pending',
            error: chunk.error
          };
          jsonSafeChunks.push(safeChunk);
        });
      }
      
      jsonSafeMetadata.chunking = {
        isChunked: metadata.chunking.isChunked,
        totalDuration: metadata.chunking.totalDuration,
        chunks: jsonSafeChunks,
        status: metadata.chunking.status || "prepared",
        processedAt: metadata.chunking.processedAt || new Date().toISOString(),
        error: metadata.chunking.error
      };
    }
    
    return jsonSafeMetadata;
  } catch (error) {
    console.error("[DEBUG] Error converting metadata to JSON-safe format:", error);
    // Return a simplified version in case of errors
    return {
      duration: metadata.duration || 0,
      file_size: metadata.file_size || 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Helper function to convert JsonSafeVideoMetadata back to ExtendedVideoMetadata
 */
export function fromJsonSafe(jsonMetadata: Json): ExtendedVideoMetadata {
  try {
    if (typeof jsonMetadata !== 'object' || !jsonMetadata) {
      return {};
    }
    
    const metadata = jsonMetadata as Record<string, any>;
    
    const result: ExtendedVideoMetadata = {
      duration: metadata.duration,
      original_file_name: metadata.original_file_name,
      file_type: metadata.file_type,
      file_size: metadata.file_size,
    };
    
    if (metadata.chunking) {
      const chunking = metadata.chunking as any;
      result.chunking = {
        isChunked: chunking.isChunked,
        totalDuration: chunking.totalDuration,
        chunks: Array.isArray(chunking.chunks) ? chunking.chunks : [],
        status: chunking.status as any,
        processedAt: chunking.processedAt,
        error: chunking.error
      };
    }
    
    return result;
  } catch (error) {
    console.error("[DEBUG] Error converting JSON-safe format back to metadata:", error);
    return {}; // Return empty object in case of errors
  }
}
