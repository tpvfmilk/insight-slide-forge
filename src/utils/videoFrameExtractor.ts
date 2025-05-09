
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
    
    // Track failed extraction attempts to retry with a different approach
    const failedExtractions: string[] = [];
    
    // Set up video event handlers
    video.onloadeddata = function() {
      console.log(`Video loaded successfully. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
      
      // Attempt to play the video for a moment to ensure frames are loaded
      // This can help with some browsers/formats that need playback to properly load content
      video.play().catch(err => {
        console.log("Video auto-play attempt failed (expected):", err);
      });
      
      // Wait a bit for video to potentially buffer frames
      setTimeout(() => {
        // Pause video after brief playing
        video.pause();
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        
        // Get actual video duration from the loaded video
        const actualVideoDuration = video.duration;
        console.log(`Actual video duration: ${actualVideoDuration}s`);
        
        // Use the smaller of the provided videoDuration parameter and the actual video.duration
        // This ensures we always use the most accurate (and most restrictive) duration
        const maxDuration = videoDuration !== undefined 
          ? Math.min(videoDuration, actualVideoDuration)
          : actualVideoDuration;
          
        console.log(`Using max duration of ${maxDuration}s for timestamp validation`);
        
        // Filter timestamps that exceed video duration, with a safety margin
        const safetyMarginSeconds = 1; // 1 second safety margin
        const validTimestamps = timestamps.filter(ts => {
          const seconds = timestampToSeconds(ts);
          const isValid = seconds <= (maxDuration - safetyMarginSeconds);
          if (!isValid) {
            console.log(`Timestamp ${ts} (${seconds}s) exceeds safe video duration (${maxDuration - safetyMarginSeconds}s) and will be skipped`);
          }
          return isValid;
        });
        
        console.log(`Processing ${validTimestamps.length} valid timestamps out of ${timestamps.length} provided`);
        
        if (validTimestamps.length === 0) {
          console.warn("No valid timestamps found within video duration");
          
          // If the video has some duration, create a few frames at strategic points
          if (maxDuration > 0) {
            const fallbackTimestamps = [];
            
            // Take frames at 25%, 50%, and 75% of the video duration
            const points = [0.25, 0.5, 0.75];
            for (const point of points) {
              if (point * maxDuration < maxDuration - safetyMarginSeconds) {
                const timestamp = formatDuration(point * maxDuration);
                fallbackTimestamps.push(timestamp);
              }
            }
            
            if (fallbackTimestamps.length > 0) {
              console.log(`Generated ${fallbackTimestamps.length} fallback timestamps: ${fallbackTimestamps.join(', ')}`);
              
              // Process the fallback timestamps
              processNextTimestamp(fallbackTimestamps, 0);
              return;
            }
          }
          
          resolve([]); // Return empty array if no valid timestamps and couldn't create fallbacks
          return;
        }
        
        // Sort timestamps and deduplicate them
        const uniqueTimestamps = Array.from(new Set(validTimestamps)).sort((a, b) => 
          timestampToSeconds(a) - timestampToSeconds(b)
        );
        
        // Log the timestamps we'll be processing
        console.log(`Processing ${uniqueTimestamps.length} timestamps: ${uniqueTimestamps.join(", ")}`);
        
        // Process timestamps sequentially
        processNextTimestamp(uniqueTimestamps, 0);
      }, 1000); // Give the video a second to load frames
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
        
        // Handle any failed extractions with a different approach
        if (failedExtractions.length > 0) {
          console.log(`Retrying ${failedExtractions.length} failed extractions with different approach...`);
          retryFailedExtractions(failedExtractions, 0);
        } else {
          resolve(frames);
        }
        return;
      }
      
      const timestamp = validTimestamps[index];
      const seconds = timestampToSeconds(timestamp);
      
      console.log(`Extracting frame at timestamp ${timestamp} (${seconds}s), ${index + 1}/${validTimestamps.length}`);
      
      // First try with a small offset to avoid exact boundary issues
      extractFrameAtTime(seconds, timestamp, (success) => {
        if (success) {
          // Move to next timestamp
          processNextTimestamp(validTimestamps, index + 1);
        } else {
          // Add to failed list to retry later with a different approach
          failedExtractions.push(timestamp);
          processNextTimestamp(validTimestamps, index + 1);
        }
      });
    }
    
    // Function to retry extractions that failed with the first approach
    function retryFailedExtractions(failedTimestamps: string[], index: number) {
      if (index >= failedTimestamps.length) {
        console.log(`Retry complete. Total frames extracted: ${frames.length}`);
        resolve(frames);
        return;
      }
      
      const timestamp = failedTimestamps[index];
      const seconds = timestampToSeconds(timestamp);
      
      console.log(`Retrying extraction at ${timestamp} with alternative approach...`);
      
      // Try with a larger offset and repeated attempts
      let attempts = 0;
      const maxAttempts = 3;
      const tryExtraction = () => {
        const offset = attempts * 0.1; // Try different offsets: 0.1, 0.2, 0.3 seconds
        extractFrameAtTime(seconds + offset, timestamp, (success) => {
          if (success) {
            retryFailedExtractions(failedTimestamps, index + 1);
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(tryExtraction, 300);
          } else {
            // If all attempts fail, create a placeholder frame with text
            createPlaceholderFrame(timestamp, () => {
              retryFailedExtractions(failedTimestamps, index + 1);
            });
          }
        });
      };
      
      tryExtraction();
    }
    
    // Extract frame at a specific time
    function extractFrameAtTime(seconds: number, timestamp: string, callback: (success: boolean) => void) {
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
            
            // More aggressive check for non-black pixels
            for (let i = 0; i < imageData.data.length; i += 4) {
              const r = imageData.data[i];
              const g = imageData.data[i+1];
              const b = imageData.data[i+2];
              // Consider anything significantly non-black as content
              if (r > 15 || g > 15 || b > 15) {
                hasContent = true;
                break;
              }
            }
            
            if (!hasContent) {
              console.warn(`Frame at ${timestamp} appears to be black or empty. Trying to fix...`);
              
              // Force a redraw to try to fix black frames - try forward/back seek approach
              const currentTime = video.currentTime;
              video.currentTime = currentTime + 0.5; // Skip forward
              
              setTimeout(() => {
                video.currentTime = currentTime; // Back to original time
                
                setTimeout(() => {
                  ctx!.clearRect(0, 0, canvas.width, canvas.height);
                  ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Check again if we have content now
                  const imageData = ctx!.getImageData(0, 0, 20, 20);
                  let hasContentNow = false;
                  for (let i = 0; i < imageData.data.length; i += 4) {
                    if (imageData.data[i] > 15 || imageData.data[i+1] > 15 || imageData.data[i+2] > 15) {
                      hasContentNow = true;
                      break;
                    }
                  }
                  
                  if (hasContentNow) {
                    finalizeFrame(true);
                  } else {
                    console.warn(`Frame at ${timestamp} still black after retry. Using placeholder.`);
                    callback(false);
                  }
                }, 300);
              }, 300);
            } else {
              finalizeFrame(true);
            }
            
            function finalizeFrame(success: boolean) {
              if (!success) {
                callback(false);
                return;
              }
              
              // Convert canvas to blob
              canvas.toBlob((blob) => {
                if (blob) {
                  frames.push({
                    timestamp,
                    frame: blob
                  });
                  
                  // Update progress
                  framesProcessed++;
                  if (progressCallback) {
                    progressCallback(framesProcessed, timestamps.length);
                  }
                  
                  callback(true);
                } else {
                  console.error(`Failed to create blob for timestamp ${timestamp}`);
                  callback(false);
                }
              }, "image/jpeg", 0.95); // Use JPEG format with 95% quality
            }
          } else {
            console.error("Canvas context is null");
            callback(false);
          }
        }, 500); // Longer delay to ensure frame is loaded
      };
    }
    
    // Create a placeholder frame with text when all extraction attempts fail
    function createPlaceholderFrame(timestamp: string, callback: () => void) {
      console.log(`Creating placeholder frame for ${timestamp}`);
      
      if (ctx) {
        // Clear canvas and create a colored background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#2563eb"; // Blue background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add text explanation
        ctx.fillStyle = "white";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`Frame at ${timestamp} unavailable`, canvas.width / 2, canvas.height / 2 - 15);
        ctx.font = "18px Arial";
        ctx.fillText("Frame could not be extracted from video", canvas.width / 2, canvas.height / 2 + 20);
        
        canvas.toBlob((blob) => {
          if (blob) {
            frames.push({
              timestamp,
              frame: blob
            });
            
            // Update progress
            framesProcessed++;
            if (progressCallback) {
              progressCallback(framesProcessed, timestamps.length);
            }
          }
          callback();
        }, "image/jpeg", 0.95);
      } else {
        callback();
      }
    }
    
    // Helper function to format seconds as a timestamp string
    function formatDuration(seconds: number): string {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
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
