import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExtendedVideoMetadata, ChunkMetadata, ChunkingInfo } from "@/types/videoChunking";
import { parseStoragePath } from "@/utils/videoPathUtils";

/**
 * Maximum recommended size for video chunks for optimal transcription
 * Using 24MB to stay under OpenAI's 25MB limit
 */
export const MAX_CHUNK_SIZE_MB = 24;

/**
 * Minimum chunk duration in seconds
 * Prevents creating too many tiny chunks
 */
export const MIN_CHUNK_DURATION = 60; // 1 minute

/**
 * Maximum chunk duration in seconds
 * Prevents creating very large chunks
 */
export const MAX_CHUNK_DURATION = 600; // 10 minutes

/**
 * Checks if a video file is too large for direct transcription
 * @param fileSize File size in bytes
 * @returns boolean indicating if the file needs chunking
 */
export const videoNeedsChunking = (fileSize: number): boolean => {
  const fileSizeMB = fileSize / (1024 * 1024);
  return fileSizeMB > MAX_CHUNK_SIZE_MB;
};

/**
 * Analyzes a video file and creates metadata for chunking
 * @param file Video file to analyze
 * @returns Promise with the chunk metadata or null if analysis fails
 */
export const analyzeVideoForChunking = async (
  file: File
): Promise<ExtendedVideoMetadata | null> => {
  try {
    // Use HTML5 video element to get video duration
    const videoDuration = await getVideoDuration(file);
    if (!videoDuration) {
      console.error("Could not determine video duration");
      return null;
    }

    console.log(`Video duration: ${videoDuration} seconds`);
    
    // Determine if the video needs chunking
    const needsChunking = videoNeedsChunking(file.size);
    if (!needsChunking) {
      console.log("Video does not need chunking");
      return {
        duration: videoDuration,
        original_file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        chunking: {
          isChunked: false,
          totalDuration: videoDuration,
          chunks: []
        }
      };
    }
    
    // Calculate optimal chunk size based on video duration and file size
    const chunks = calculateOptimalChunks(videoDuration, file.size);
    
    console.log(`Created ${chunks.length} chunks for video`);
    
    // Create extended metadata with chunking information
    return {
        duration: videoDuration,
        original_file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        chunking: {
          isChunked: true,
          totalDuration: videoDuration,
          chunks: chunks,
          status: "prepared" // Add status field to track chunking progress
        }
    };
  } catch (error) {
    console.error("Error analyzing video for chunking:", error);
    return null;
  }
};

/**
 * Gets the duration of a video file
 * @param file Video file
 * @returns Promise with the duration in seconds
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
      console.error("Error getting video duration");
      resolve(0); // Return 0 if we can't get the duration
    };
    
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Calculates optimal chunk boundaries for a video
 * @param duration Total video duration in seconds
 * @param fileSize Total file size in bytes
 * @returns Array of chunk metadata objects
 */
export const calculateOptimalChunks = (
  duration: number, 
  fileSize: number
): ChunkMetadata[] => {
  const chunks: ChunkMetadata[] = [];
  
  // Calculate bytes per second (approximate)
  const bytesPerSecond = fileSize / duration;
  
  // Calculate ideal chunk duration to stay under MAX_CHUNK_SIZE_MB
  const maxChunkSizeBytes = MAX_CHUNK_SIZE_MB * 1024 * 1024;
  let idealChunkDuration = Math.floor(maxChunkSizeBytes / bytesPerSecond);
  
  // Ensure chunk duration is between MIN and MAX thresholds
  idealChunkDuration = Math.min(MAX_CHUNK_DURATION, Math.max(MIN_CHUNK_DURATION, idealChunkDuration));
  
  console.log(`Ideal chunk duration: ${idealChunkDuration} seconds`);
  
  // Create chunks based on the ideal duration
  let startTime = 0;
  let chunkIndex = 0;
  
  while (startTime < duration) {
    // For the last chunk, make sure we don't exceed the total duration
    const chunkDuration = Math.min(idealChunkDuration, duration - startTime);
    const endTime = startTime + chunkDuration;
    
    chunks.push({
      index: chunkIndex,
      startTime: startTime,
      endTime: endTime,
      duration: chunkDuration,
      videoPath: "", // Will be filled in later when the chunk is created
      title: `Chunk ${chunkIndex + 1}`
    });
    
    startTime = endTime;
    chunkIndex++;
  }
  
  return chunks;
};

/**
 * Creates video chunks from a source video and uploads them to storage
 * @param file Source video file 
 * @param projectId Project ID
 * @param chunkMetadata Metadata for the chunks
 * @returns Promise with updated chunk metadata or null if chunking fails
 */
export const createVideoChunks = async (
  file: File,
  projectId: string,
  chunkMetadata: ChunkMetadata[]
): Promise<ChunkMetadata[] | null> => {
  try {
    // FFmpeg is not available in browser context
    // Instead, we'll upload the entire video and let the server handle chunking
    
    toast.info("Video is too large for direct transcription. Preparing for chunked processing...");
    
    // Upload the original video file first
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      toast.error("You need to be logged in to upload videos");
      return null;
    }
    
    // Upload the original file to a special chunks directory
    const originalFilePath = `chunks/${projectId}/original_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('video_uploads')
      .upload(originalFilePath, file, {
        cacheControl: '3600',
        upsert: true // Changed to true to allow re-uploads
      });
    
    if (uploadError) {
      console.error("Error uploading original video for chunking:", uploadError);
      toast.error("Failed to upload video for chunking");
      return null;
    }
    
    toast.success("Video uploaded successfully. It will be processed in chunks for transcription.");
    
    // Update the chunk metadata with paths that would be created by the server
    const updatedChunks = chunkMetadata.map((chunk, index) => {
      // Create a path for this chunk
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const extension = file.name.split('.').pop();
      const chunkFileName = `${fileNameWithoutExt}_chunk_${index + 1}.${extension}`;
      const chunkPath = `chunks/${projectId}/${chunkFileName}`;
      
      return {
        ...chunk,
        videoPath: chunkPath
      };
    });
    
    return updatedChunks;
  } catch (error) {
    console.error("Error creating video chunks:", error);
    toast.error("Failed to process video chunks");
    return null;
  }
};

/**
 * Initiates server-side chunking process for a video
 * @param projectId The project ID
 * @param sourceFilePath Path to the original video
 * @returns Promise with status of the chunking process
 */
export const initiateServerSideChunking = async (
  projectId: string,
  sourceFilePath: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('video_metadata')
      .eq('id', projectId)
      .single();
      
    // Need to cast to ExtendedVideoMetadata to access chunking property  
    const videoMetadata = project?.video_metadata as ExtendedVideoMetadata | null;
    
    if (!videoMetadata?.chunking) {
      console.error("Project doesn't have chunking metadata");
      return { success: false, error: "Missing chunking metadata" };
    }
    
    // Call the video-chunker function to create chunks on the server
    const { data, error } = await supabase.functions.invoke('video-chunker', {
      body: { 
        projectId,
        originalVideoPath: sourceFilePath,
        chunkingMetadata: videoMetadata.chunking
      }
    });
    
    if (error) {
      console.error("Error calling video-chunker:", error);
      return { success: false, error: error.message };
    }
    
    console.log("Server-side chunking initiated:", data);
    return { success: true };
  } catch (error) {
    console.error("Error initiating server-side chunking:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Extract chunk timemarks from a project's video metadata
 * @param project Project object that may contain chunked video metadata
 * @returns Array of timemarks (in seconds) where chunks start
 */
export const getChunkTimemarksFromProject = (project: any): number[] => {
  if (!project || !project.video_metadata) {
    return [];
  }
  
  // Cast to ExtendedVideoMetadata to access chunking property
  const metadata = project.video_metadata as ExtendedVideoMetadata;
  
  if (!metadata.chunking?.isChunked || !metadata.chunking.chunks || metadata.chunking.chunks.length === 0) {
    return [];
  }
  
  // Extract start times from chunks
  return metadata.chunking.chunks.map((chunk: ChunkMetadata) => chunk.startTime);
};

/**
 * Get all timemarks from a video's chunking info
 * @param metadata The video metadata containing chunking information
 * @returns Array of timemarks (in seconds) where chunks start
 */
export const getChunkTimemarks = (metadata: ExtendedVideoMetadata | null): number[] => {
  if (!metadata || !metadata.chunking || !metadata.chunking.isChunked || !metadata.chunking.chunks) {
    return [];
  }
  
  // Extract start times from chunks
  return metadata.chunking.chunks.map(chunk => chunk.startTime);
};

/**
 * Get chunk info for a specific time in the video
 * @param time Time in seconds
 * @param metadata The video metadata containing chunking information
 * @returns Human-readable description of the chunk or null if not found
 */
export const getChunkInfoAtTime = (time: number, metadata: ExtendedVideoMetadata | null): string | null => {
  if (!metadata || !metadata.chunking || !metadata.chunking.isChunked || !metadata.chunking.chunks) {
    return null;
  }
  
  // Find the chunk that contains this time
  const chunk = metadata.chunking.chunks.find(
    chunk => time >= chunk.startTime && time < (chunk.endTime || Infinity)
  );
  
  if (!chunk) {
    return null;
  }
  
  return `Chunk ${chunk.index + 1} (${Math.floor(chunk.duration || 0)}s)`;
};
