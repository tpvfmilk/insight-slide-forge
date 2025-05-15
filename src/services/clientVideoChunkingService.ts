
import { MAX_CHUNK_SIZE_MB, MIN_CHUNK_DURATION, MAX_CHUNK_DURATION } from "./videoChunkingService";
import { ChunkMetadata } from "@/types/videoChunking";
import { toast } from "sonner";

/**
 * Creates a video blob segment from the main video file
 * @param videoFile Original video file
 * @param startTime Start time in seconds
 * @param duration Duration of chunk in seconds
 * @returns Promise resolving to a blob representing the video segment
 */
export const createVideoChunkBlob = async (
  videoFile: File,
  startTime: number,
  duration: number
): Promise<Blob | null> => {
  try {
    // Create a URL for the video file
    const videoUrl = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    
    // Set up video properties
    video.src = videoUrl;
    video.currentTime = startTime;
    video.muted = true;
    
    // Wait for video to load metadata
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });
    
    // We'll use MediaRecorder to record the video segment
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error("Could not create canvas context");
    }
    
    // Set canvas size to match video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Create a media stream from the canvas
    const stream = canvas.captureStream();
    
    // Set up MediaRecorder with appropriate video codec
    const recorder = new MediaRecorder(stream, {
      mimeType: videoFile.type || 'video/webm',
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    });
    
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    
    // Start recording
    recorder.start(100); // Collect data every 100ms
    
    // Play the video
    video.play();
    
    // Function to draw video frame to canvas
    const drawFrame = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Check if we've recorded enough
      if (video.currentTime < startTime + duration && !video.ended) {
        requestAnimationFrame(drawFrame);
      } else {
        // Stop recording
        recorder.stop();
        video.pause();
      }
    };
    
    // Start drawing frames
    drawFrame();
    
    // Wait for recorder to finish
    const recordedBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const recordedBlob = new Blob(chunks, { type: videoFile.type || 'video/webm' });
        resolve(recordedBlob);
      };
    });
    
    // Clean up
    URL.revokeObjectURL(videoUrl);
    
    return recordedBlob;
  } catch (error) {
    console.error("[DEBUG] Error creating video chunk:", error);
    return null;
  }
};

/**
 * Creates a video file segment from the main video file
 * @param videoFile Original video file
 * @param startTime Start time in seconds
 * @param duration Duration of chunk in seconds
 * @param index Chunk index
 * @returns Promise resolving to a File object representing the video segment
 */
export const createVideoChunkFile = async (
  videoFile: File,
  startTime: number,
  duration: number,
  index: number
): Promise<File | null> => {
  try {
    const blob = await createVideoChunkBlob(videoFile, startTime, duration);
    if (!blob) return null;
    
    // Extract file extension
    const extension = videoFile.name.split('.').pop() || 'mp4';
    const nameWithoutExt = videoFile.name.replace(/\.[^/.]+$/, "");
    
    // Create a new filename for the chunk
    const chunkFileName = `${nameWithoutExt}_chunk_${index + 1}.${extension}`;
    
    // Create a File object from the blob
    return new File([blob], chunkFileName, { 
      type: videoFile.type || `video/${extension}`,
      lastModified: Date.now()
    });
  } catch (error) {
    console.error("[DEBUG] Error creating video chunk file:", error);
    return null;
  }
};

/**
 * Analyzes a video file and chunks it appropriately
 * @param videoFile Video file to analyze and chunk
 * @param onProgress Optional callback for progress updates
 * @returns Promise resolving to an array of chunk files
 */
export const chunkVideoFile = async (
  videoFile: File,
  onProgress?: (progress: number, message: string) => void
): Promise<{chunks: File[], metadata: ChunkMetadata[]} | null> => {
  try {
    // Create a URL for the video file
    const videoUrl = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    
    // Set up video properties
    video.src = videoUrl;
    video.preload = 'metadata';
    
    onProgress?.(5, "Analyzing video file...");
    
    // Wait for video to load metadata
    const duration = await new Promise<number>((resolve) => {
      video.onloadedmetadata = () => resolve(video.duration);
    });
    
    // Clean up URL
    URL.revokeObjectURL(videoUrl);
    
    // Calculate bytes per second (approximate)
    const bytesPerSecond = videoFile.size / duration;
    
    // Calculate ideal chunk duration to stay under MAX_CHUNK_SIZE_MB
    const maxChunkSizeBytes = MAX_CHUNK_SIZE_MB * 1024 * 1024;
    let idealChunkDuration = Math.floor(maxChunkSizeBytes / bytesPerSecond);
    
    // Ensure chunk duration is between MIN and MAX thresholds
    idealChunkDuration = Math.min(MAX_CHUNK_DURATION, Math.max(MIN_CHUNK_DURATION, idealChunkDuration));
    
    console.log(`[DEBUG] Video duration: ${duration} seconds`);
    console.log(`[DEBUG] Ideal chunk duration: ${idealChunkDuration} seconds`);
    
    // Create chunks based on the ideal duration
    const chunkMetadata: ChunkMetadata[] = [];
    const chunkTasks: Promise<File | null>[] = [];
    let startTime = 0;
    let chunkIndex = 0;
    
    onProgress?.(10, "Planning video chunks...");
    
    while (startTime < duration) {
      // For the last chunk, make sure we don't exceed the total duration
      const chunkDuration = Math.min(idealChunkDuration, duration - startTime);
      const endTime = startTime + chunkDuration;
      
      // Create temporary metadata (videoPath will be updated later)
      chunkMetadata.push({
        index: chunkIndex,
        startTime: startTime,
        endTime: endTime,
        duration: chunkDuration,
        videoPath: "", // Will be filled in later
        title: `Chunk ${chunkIndex + 1}`,
        status: "pending"
      });
      
      // Queue the chunk creation task
      chunkTasks.push(createVideoChunkFile(videoFile, startTime, chunkDuration, chunkIndex));
      
      startTime = endTime;
      chunkIndex++;
    }
    
    onProgress?.(20, `Creating ${chunkMetadata.length} video chunks...`);
    
    // Process all the chunks with progress updates
    const chunkFiles: File[] = [];
    let completedChunks = 0;
    
    // Process chunks in sequence to avoid memory issues
    for (let i = 0; i < chunkTasks.length; i++) {
      const chunkFile = await chunkTasks[i];
      completedChunks++;
      
      const progressPercent = 20 + Math.floor((completedChunks / chunkTasks.length) * 70);
      onProgress?.(progressPercent, `Processing chunk ${completedChunks} of ${chunkTasks.length}...`);
      
      if (chunkFile) {
        chunkFiles.push(chunkFile);
      } else {
        console.error(`[DEBUG] Failed to create chunk ${i+1}`);
      }
    }
    
    onProgress?.(95, "Finalizing chunks...");
    
    if (chunkFiles.length === 0) {
      toast.error("Failed to create any video chunks");
      return null;
    }
    
    onProgress?.(100, "Chunks created successfully");
    
    return {chunks: chunkFiles, metadata: chunkMetadata};
  } catch (error) {
    console.error("[DEBUG] Error chunking video file:", error);
    toast.error("Failed to chunk video file");
    return null;
  }
};

/**
 * Enhanced version of the original chunking method that determines
 * if a video needs chunking and either chunks it or returns it as-is
 * @param videoFile The video file to process
 * @param onProgress Optional progress callback
 * @returns Promise resolving to the original file or chunked files
 */
export const processVideoForChunking = async (
  videoFile: File,
  onProgress?: (progress: number, message: string) => void
): Promise<{
  needsChunking: boolean;
  originalFile: File;
  chunkFiles: File[];
  chunkMetadata: ChunkMetadata[];
}> => {
  // Calculate file size in MB
  const fileSizeMB = videoFile.size / (1024 * 1024);
  
  // Determine if the file needs chunking
  const needsChunking = fileSizeMB > MAX_CHUNK_SIZE_MB;
  
  if (!needsChunking) {
    // Return the file as-is if it's small enough
    onProgress?.(100, "Video doesn't need chunking");
    return {
      needsChunking: false,
      originalFile: videoFile,
      chunkFiles: [],
      chunkMetadata: []
    };
  }
  
  onProgress?.(0, "Starting video chunking process...");
  const result = await chunkVideoFile(videoFile, onProgress);
  
  if (!result) {
    // If chunking fails, return the original file
    toast.warning("Video chunking failed, using original file instead");
    return {
      needsChunking: true,
      originalFile: videoFile,
      chunkFiles: [],
      chunkMetadata: []
    };
  }
  
  return {
    needsChunking: true,
    originalFile: videoFile,
    chunkFiles: result.chunks,
    chunkMetadata: result.metadata
  };
};
