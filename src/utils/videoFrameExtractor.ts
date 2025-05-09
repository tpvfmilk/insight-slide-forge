
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
      // Fixed TypeScript error by properly checking event type
      if (typeof e === 'string') {
        reject(new Error(`Failed to load video: ${e}`));
        return;
      }
      
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
        
        // Make sure video is fully ready before capturing frames
        // This is the key fix for black frames - we ensure the video frame is fully loaded
        setTimeout(() => {
          if (ctx) {
            // Clear the canvas before drawing new content
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw the current frame on the canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Add timestamp as text overlay for debugging (can be commented out in production)
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(10, 10, 300, 30);
            ctx.fillStyle = "white";
            ctx.font = "16px Arial";
            ctx.fillText(`Timestamp: ${timestamp} (${seconds.toFixed(2)}s)`, 15, 30);
            
            // Check if canvas is actually rendering content (debug for black frames)
            const imageData = ctx.getImageData(0, 0, 20, 20);
            let hasContent = false;
            for (let i = 0; i < imageData.data.length; i += 4) {
              if (imageData.data[i] > 0 || imageData.data[i+1] > 0 || imageData.data[i+2] > 0) {
                hasContent = true;
                break;
              }
            }
            
            if (!hasContent) {
              console.warn(`Frame at ${timestamp} appears to be black or empty. Trying to fix...`);
              
              // Force a redraw to try to fix black frames
              video.currentTime = seconds + 0.01;
              setTimeout(() => {
                ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                finalizeFrame();
              }, 100);
            } else {
              finalizeFrame();
            }
            
            function finalizeFrame() {
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
            }
          } else {
            console.error("Canvas context is null");
            processNextTimestamp(validTimestamps, index + 1);
          }
        }, 100); // Short delay to ensure frame is loaded
      };
    }
    
    // Start loading the video
    console.log(`Loading video from URL: ${videoUrl}`);
    video.muted = true;  // Mute to avoid any audio playback
    video.playsInline = true; // Better mobile compatibility
    video.preload = "auto";
    video.src = videoUrl;
    
    // Force the video to load its metadata
    video.load();
  });
}
