
import { timestampToSeconds } from "./formatUtils";

/**
 * Extract frames from a video at specific timestamps
 * @param videoUrl URL of the video
 * @param timestamps Array of timestamps as strings in the format "HH:MM:SS"
 * @param progressCallback Optional callback function to report progress
 * @param videoDuration Optional video duration to validate timestamps
 * @returns Array of objects containing extracted frame as Blob and the corresponding timestamp
 */
export async function extractFramesFromVideoUrl(
  videoUrl: string,
  timestamps: string[],
  progressCallback?: (completed: number, total: number) => void,
  videoDuration?: number
): Promise<Array<{ timestamp: string; frame: Blob }>> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous"; // Enable CORS for the video
    
    // Array to store extracted frames
    const frames: Array<{ timestamp: string; frame: Blob }> = [];
    
    // Number of frames processed
    let framesProcessed = 0;
    
    // Create a canvas element for frame extraction
    const canvas = document.createElement("canvas");
    let ctx: CanvasRenderingContext2D | null = null;
    
    // Set up video event handlers
    video.onloadeddata = function() {
      console.log(`Video loaded successfully. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      // Sort timestamps and deduplicate them
      const uniqueTimestamps = Array.from(new Set(timestamps)).sort((a, b) => 
        timestampToSeconds(a) - timestampToSeconds(b)
      );
      
      // Log the timestamps we'll be processing
      console.log(`Processing ${uniqueTimestamps.length} timestamps: ${uniqueTimestamps.join(", ")}`);
      
      // Filter timestamps that exceed video duration
      const validTimestamps = videoDuration 
        ? uniqueTimestamps.filter(ts => timestampToSeconds(ts) <= videoDuration)
        : uniqueTimestamps;
      
      if (validTimestamps.length < uniqueTimestamps.length) {
        console.warn(`Filtered out ${uniqueTimestamps.length - validTimestamps.length} timestamps that exceed video duration`);
      }
      
      // Process timestamps sequentially
      processNextTimestamp(validTimestamps, 0);
    };
    
    video.onerror = function(e) {
      const videoEl = e.target as HTMLVideoElement;
      let errorMessage = "Unknown error";
      
      if (videoEl.error) {
        switch(videoEl.error.code) {
          case 1: errorMessage = "Video loading aborted"; break;
          case 2: errorMessage = "Network error"; break;
          case 3: errorMessage = "Video decoding failed"; break;
          case 4: errorMessage = "Video not supported"; break;
        }
      }
      
      console.error(`Video error: ${errorMessage}`, videoEl.error);
      reject(new Error(`Failed to load video: ${errorMessage}`));
    };
    
    // Process timestamps one by one to avoid race conditions
    function processNextTimestamp(validTimestamps: string[], index: number) {
      if (index >= validTimestamps.length) {
        // All frames processed
        console.log(`Successfully extracted ${frames.length} frames from video`);
        resolve(frames);
        return;
      }
      
      const timestamp = validTimestamps[index];
      const seconds = timestampToSeconds(timestamp);
      
      console.log(`Extracting frame at timestamp ${timestamp} (${seconds}s), ${index + 1}/${validTimestamps.length}`);
      
      // Set current time and wait for seeking to complete
      video.currentTime = seconds;
      
      // Handle the 'seeked' event
      video.onseeked = function() {
        console.log(`Seeked to ${video.currentTime}s for timestamp ${timestamp}`);
        
        if (ctx) {
          // Draw the current frame on the canvas
          ctx.drawImage(video, 0, 0);
          
          // Add timestamp as text overlay for debugging (can be commented out in production)
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.fillRect(10, 10, 300, 30);
          ctx.fillStyle = "white";
          ctx.font = "16px Arial";
          ctx.fillText(`Timestamp: ${timestamp} (${seconds.toFixed(2)}s)`, 15, 30);
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob) {
              frames.push({
                timestamp,
                frame: blob
              });
            } else {
              console.error(`Failed to create blob for timestamp ${timestamp}`);
            }
            
            // Update progress
            framesProcessed++;
            if (progressCallback) {
              progressCallback(framesProcessed, validTimestamps.length);
            }
            
            // Process next timestamp
            processNextTimestamp(validTimestamps, index + 1);
          }, "image/jpeg", 0.95); // Use JPEG format with 95% quality
        } else {
          console.error("Canvas context is null");
          processNextTimestamp(validTimestamps, index + 1);
        }
      };
    }
    
    // Start loading the video
    console.log(`Loading video from URL: ${videoUrl}`);
    video.src = videoUrl;
    video.preload = "auto";
  });
}
