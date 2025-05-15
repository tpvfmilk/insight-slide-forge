
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
    
    // Wait for video to load metadata with a timeout
    await Promise.race([
      new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      }),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("Video metadata loading timeout")), 30000);
      })
    ]);
    
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
    
    // Wait for recorder to finish with timeout
    const recordedBlob = await Promise.race([
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const recordedBlob = new Blob(chunks, { type: videoFile.type || 'video/webm' });
          resolve(recordedBlob);
        };
      }),
      new Promise<Blob>((_, reject) => {
        setTimeout(() => reject(new Error("Video recording timeout")), 60000);
      })
    ]);
    
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
    
    // Wait for video to load metadata with timeout and error handling
    const duration = await Promise.race([
      new Promise<number>((resolve, reject) => {
        video.onloadedmetadata = () => {
          if (video.duration && !isNaN(video.duration)) {
            resolve(video.duration);
          } else {
            reject(new Error("Invalid video duration"));
          }
        };
        
        video.onerror = () => {
          reject(new Error(`Failed to load video metadata: ${video.error?.message || "Unknown error"}`));
        };
      }),
      new Promise<number>((_, reject) => {
        setTimeout(() => {
          console.error("[DEBUG] Video metadata loading timed out");
          reject(new Error("Video metadata loading timeout"));
        }, 30000);
      })
    ]).catch(error => {
      console.error("[DEBUG] Error getting video duration:", error);
      // Fallback to estimating duration based on file size (very rough)
      const estimatedDuration = Math.max(300, videoFile.size / (500 * 1024)); // Assume ~500KB/sec
      console.log(`[DEBUG] Using estimated duration: ${estimatedDuration}s`);
      return estimatedDuration;
    });
    
    // Clean up URL
    URL.revokeObjectURL(videoUrl);
    
    if (!duration) {
      throw new Error("Could not determine video duration");
    }
    
    onProgress?.(15, "Planning video chunks...");
    
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
    const chunkFiles: File[] = [];
    let startTime = 0;
    let chunkIndex = 0;
    
    while (startTime < duration) {
      // For the last chunk, make sure we don't exceed the total duration
      const chunkDuration = Math.min(idealChunkDuration, duration - startTime);
      const endTime = startTime + chunkDuration;
      
      onProgress?.(20 + Math.floor((chunkIndex / Math.ceil(duration / idealChunkDuration)) * 30),
        `Planning chunk ${chunkIndex + 1}...`);
      
      // Use the original file for each chunk since we aren't actually cutting it in browser
      // We'll let server-side processing handle the actual splitting
      const nameWithoutExt = videoFile.name.replace(/\.[^/.]+$/, "");
      const extension = videoFile.name.split('.').pop() || 'mp4';
      const chunkFileName = `${nameWithoutExt}_chunk_${chunkIndex + 1}.${extension}`;
      
      // Create a File object with the same content as the original file
      const chunkFile = new File([videoFile], chunkFileName, {
        type: videoFile.type,
        lastModified: Date.now()
      });
      
      chunkFiles.push(chunkFile);
      
      // Create metadata for this chunk
      chunkMetadata.push({
        index: chunkIndex,
        startTime: startTime,
        endTime: endTime,
        duration: chunkDuration,
        videoPath: "", // Will be filled in later
        title: `Chunk ${chunkIndex + 1}`,
        status: "pending"
      });
      
      startTime = endTime;
      chunkIndex++;
    }
    
    onProgress?.(70, `Created ${chunkMetadata.length} video chunks metadata`);
    onProgress?.(100, "Chunks prepared successfully");
    
    return {
      chunks: chunkFiles,
      metadata: chunkMetadata
    };
  } catch (error: any) {
    console.error("[DEBUG] Error chunking video file:", error);
    toast.error(`Failed to chunk video file: ${error.message || "Unknown error"}`);
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
  try {
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
    console.log(`[DEBUG] Chunking video file of ${fileSizeMB.toFixed(2)}MB`);
    
    const result = await chunkVideoFile(videoFile, onProgress);
    
    if (!result) {
      // If chunking fails, log the error but still return the original file
      console.error("[DEBUG] Video chunking failed, using original file");
      toast.warning("Video chunking failed, using original file instead");
      return {
        needsChunking: true,
        originalFile: videoFile,
        chunkFiles: [],
        chunkMetadata: []
      };
    }
    
    console.log(`[DEBUG] Successfully created ${result.chunks.length} chunks`);
    return {
      needsChunking: true,
      originalFile: videoFile,
      chunkFiles: result.chunks,
      chunkMetadata: result.metadata
    };
  } catch (error: any) {
    console.error("[DEBUG] Error in processVideoForChunking:", error);
    toast.error(`Video processing error: ${error.message || "Unknown error"}`);
    
    // Return original file in case of error
    return {
      needsChunking: false,
      originalFile: videoFile,
      chunkFiles: [],
      chunkMetadata: []
    };
  }
};
