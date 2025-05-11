
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
    video.playsInline = true;
    video.muted = true;
    video.preload = "auto";
    
    // Prevent video from showing in the DOM and causing UI shifts
    video.style.position = "absolute";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.height = "1px";
    video.style.width = "1px";
    
    // Temporarily add to DOM but hidden
    document.body.appendChild(video);
    
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
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx = canvas.getContext("2d", { alpha: false }); // Use non-alpha context to prevent transparency issues
      
      if (!ctx) {
        cleanupAndReject("Failed to get canvas context");
        return;
      }
      
      // Get actual video duration from the loaded video
      const actualVideoDuration = video.duration;
      console.log(`Actual video duration: ${actualVideoDuration}s`);
      
      // Filter timestamps that exceed video duration
      // Use the provided videoDuration parameter if available, otherwise use the actual duration from the video
      const maxDuration = videoDuration || actualVideoDuration;
      const validTimestamps = timestamps.filter(ts => {
        const seconds = timestampToSeconds(ts);
        const isValid = seconds <= maxDuration;
        if (!isValid) {
          console.log(`Timestamp ${ts} (${seconds}s) exceeds video duration (${maxDuration}s) and will be skipped`);
        }
        return isValid;
      });
      
      console.log(`Processing ${validTimestamps.length} valid timestamps out of ${timestamps.length} provided`);
      
      if (validTimestamps.length === 0) {
        console.warn("No valid timestamps found within video duration");
        cleanupAndResolve([]); // Return empty array if no valid timestamps
        return;
      }
      
      // Sort timestamps and deduplicate them
      const uniqueTimestamps = Array.from(new Set(validTimestamps)).sort((a, b) => 
        timestampToSeconds(a) - timestampToSeconds(b)
      );
      
      // Log the timestamps we'll be processing
      console.log(`Processing ${uniqueTimestamps.length} timestamps: ${uniqueTimestamps.join(", ")}`);
      
      // Pause video to prepare for seeking
      video.pause();
      
      // Process timestamps sequentially
      processNextTimestamp(uniqueTimestamps, 0);
    };
    
    video.onerror = function(e) {
      // Fixed TypeScript error by properly checking event type
      if (typeof e === 'string') {
        cleanupAndReject(`Failed to load video: ${e}`);
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
      cleanupAndReject(`Failed to load video: ${errorMessage}`);
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
          cleanupAndResolve(frames);
        }
        return;
      }
      
      const currentTimestamp = validTimestamps[index];
      const seconds = timestampToSeconds(currentTimestamp);
      
      console.log(`Extracting frame at timestamp ${currentTimestamp} (${seconds}s), ${index + 1}/${validTimestamps.length}`);
      
      // First try with a small offset to avoid exact boundary issues
      extractFrameAtTime(seconds, currentTimestamp, (success) => {
        if (success) {
          // Move to next timestamp
          processNextTimestamp(validTimestamps, index + 1);
        } else {
          // Add to failed list to retry later with a different approach
          failedExtractions.push(currentTimestamp);
          processNextTimestamp(validTimestamps, index + 1);
        }
      });
    }
    
    // Function to retry extractions that failed with the first approach
    function retryFailedExtractions(failedTimestamps: string[], index: number) {
      if (index >= failedTimestamps.length) {
        console.log(`Retry complete. Total frames extracted: ${frames.length}`);
        cleanupAndResolve(frames);
        return;
      }
      
      const currentTimestamp = failedTimestamps[index];
      const seconds = timestampToSeconds(currentTimestamp);
      
      console.log(`Retrying extraction at ${currentTimestamp} with alternative approach...`);
      
      // Try with a larger offset and repeated attempts
      let attempts = 0;
      const maxAttempts = 3;
      const tryExtraction = () => {
        const offset = attempts * 0.1; // Try different offsets: 0.1, 0.2, 0.3 seconds
        extractFrameAtTime(seconds + offset, currentTimestamp, (success) => {
          if (success) {
            retryFailedExtractions(failedTimestamps, index + 1);
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(tryExtraction, 300);
          } else {
            // If all attempts fail, create a placeholder frame with text
            createPlaceholderFrame(currentTimestamp, () => {
              retryFailedExtractions(failedTimestamps, index + 1);
            });
          }
        });
      };
      
      tryExtraction();
    }
    
    // Extract frame at a specific time
    function extractFrameAtTime(seconds: number, currentTimestamp: string, callback: (success: boolean) => void) {
      // Use requestAnimationFrame for more reliable timing when setting currentTime
      requestAnimationFrame(() => {
        video.currentTime = seconds;
      });
      
      // Handle the 'seeked' event
      const handleSeeked = function() {
        console.log(`Seeked to ${video.currentTime}s for timestamp ${currentTimestamp}`);
        
        // Remove event listener to avoid multiple callbacks
        video.removeEventListener('seeked', handleSeeked);
        
        // Make sure video is fully ready before capturing frames - increased delay for reliability to 1200ms
        setTimeout(() => {
          if (ctx) {
            // Clear the canvas before drawing new content
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw white background to avoid transparency issues (which can appear as black)
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Store original time before scrubbing
            const originalTime = video.currentTime;
            
            // Scrub forward by 0.1 seconds to ensure frame loading
            video.currentTime = originalTime + 0.1;
            
            // After scrubbing forward, go back to original position and capture
            setTimeout(() => {
              video.currentTime = originalTime;
              
              // Wait for the frame to stabilize at original position
              setTimeout(() => {
                // Play the video for a fraction of a second to ensure the frame is loaded
                video.play().then(() => {
                  setTimeout(() => {
                    video.pause();
                    
                    // Draw the current frame on the canvas
                    ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // Add timestamp as text overlay for debugging (can be commented out in production)
                    ctx!.fillStyle = "rgba(0, 0, 0, 0.5)";
                    ctx!.fillRect(10, 10, 300, 30);
                    ctx!.fillStyle = "white";
                    ctx!.font = "16px Arial";
                    ctx!.fillText(`Timestamp: ${currentTimestamp} (${seconds.toFixed(2)}s)`, 15, 30);
                    
                    // Check if canvas is actually rendering content (debug for black/white frames)
                    const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
                    let hasContent = false;
                    let totalBrightness = 0;
                    
                    // More aggressive check for content by sampling pixels throughout the image
                    const pixelCount = imageData.data.length / 4;
                    const sampleSize = Math.min(1000, pixelCount);
                    const step = Math.max(1, Math.floor(pixelCount / sampleSize));
                    
                    for (let i = 0; i < imageData.data.length; i += 4 * step) {
                      const r = imageData.data[i];
                      const g = imageData.data[i+1];
                      const b = imageData.data[i+2];
                      totalBrightness += (r + g + b) / 3;
                      
                      // If we find significant non-white, non-black content, we're good
                      if ((r < 240 || g < 240 || b < 240) && (r > 15 || g > 15 || b > 15)) {
                        hasContent = true;
                      }
                    }
                    
                    const avgBrightness = totalBrightness / (sampleSize * 255); // Normalize to 0-1
                    
                    // Frame is too white (>95% brightness) or too dark (<5% brightness)
                    if (avgBrightness > 0.95 || avgBrightness < 0.05 || !hasContent) {
                      console.warn(`Frame at ${currentTimestamp} appears to be blank (brightness: ${avgBrightness.toFixed(2)}). Trying to fix...`);
                      
                      // Force a redraw to try to fix blank frames
                      // Try forward/back seek approach with a larger offset
                      const currentTime = video.currentTime;
                      video.currentTime = currentTime + 0.5; // Skip forward
                      
                      // After seeking forward, seek back and try to capture again
                      setTimeout(() => {
                        video.currentTime = currentTime; // Back to original time
                        
                        setTimeout(() => {
                          // Draw a colorful background so we can detect if new content is drawn
                          ctx!.fillStyle = "rgb(200, 200, 240)";
                          ctx!.fillRect(0, 0, canvas.width, canvas.height);
                          
                          // Try to draw the video frame again
                          ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                          
                          // Check again if we have content now
                          const newData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
                          let hasContentNow = false;
                          let newBrightness = 0;
                          
                          // Sample pixels again
                          for (let i = 0; i < newData.data.length; i += 4 * step) {
                            const r = newData.data[i];
                            const g = newData.data[i+1];
                            const b = newData.data[i+2];
                            newBrightness += (r + g + b) / 3;
                            
                            // Check if pixel differs from our background color
                            if (Math.abs(r - 200) > 20 || Math.abs(g - 200) > 20 || Math.abs(b - 240) > 20) {
                              hasContentNow = true;
                            }
                          }
                          
                          if (hasContentNow) {
                            finalizeFrame(currentTimestamp, true);
                          } else {
                            console.warn(`Frame at ${currentTimestamp} still blank after retry. Trying one last approach.`);
                            
                            // One final attempt with different settings
                            video.play().then(() => {
                              setTimeout(() => {
                                video.pause();
                                ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                                finalizeFrame(currentTimestamp, true); // Just use whatever we have now
                              }, 200);
                            }).catch(() => {
                              callback(false);
                            });
                          }
                        }, 300);
                      }, 300);
                    } else {
                      finalizeFrame(currentTimestamp, true);
                    }
                  }, 100); // Short play duration
                }).catch(() => {
                  console.warn("Could not play video briefly, capturing static frame");
                  ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
                  finalizeFrame(currentTimestamp, true);
                });
              }, 300); // Wait after seeking back to original position
            }, 300); // Wait after seeking forward
          } else {
            console.error("Canvas context is null");
            callback(false);
          }
        }, 1200); // Increased delay to 1200ms to ensure frame is fully loaded
      };
      
      // Add seeked event listener
      video.addEventListener('seeked', handleSeeked);
    }
    
    function finalizeFrame(currentTimestamp: string, success: boolean) {
      if (!success || !ctx) {
        callback(false);
        return;
      }
      
      // Convert canvas to blob with high quality
      canvas.toBlob((blob) => {
        if (blob) {
          frames.push({
            timestamp: currentTimestamp,
            frame: blob
          });
          
          // Update progress
          framesProcessed++;
          if (progressCallback) {
            progressCallback(framesProcessed, timestamps.length);
          }
          
          callback(true);
        } else {
          console.error(`Failed to create blob for timestamp ${currentTimestamp}`);
          callback(false);
        }
      }, "image/jpeg", 0.98); // Use higher JPEG quality (0.98 instead of 0.95)
    }
    
    // Create a placeholder frame with text when all extraction attempts fail
    function createPlaceholderFrame(currentTimestamp: string, onComplete: () => void) {
      console.log(`Creating placeholder frame for ${currentTimestamp}`);
      
      if (ctx) {
        // Clear canvas and create a colored background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#2563eb"; // Blue background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add text explanation
        ctx.fillStyle = "white";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`Frame at ${currentTimestamp} unavailable`, canvas.width / 2, canvas.height / 2 - 15);
        ctx.font = "18px Arial";
        ctx.fillText("Frame could not be extracted from video", canvas.width / 2, canvas.height / 2 + 20);
        
        canvas.toBlob((blob) => {
          if (blob) {
            frames.push({
              timestamp: currentTimestamp,
              frame: blob
            });
            
            // Update progress
            framesProcessed++;
            if (progressCallback) {
              progressCallback(framesProcessed, timestamps.length);
            }
          }
          onComplete();
        }, "image/jpeg", 0.95);
      } else {
        onComplete();
      }
    }
    
    // Cleanup function to remove video element
    function cleanupAndReject(message: string) {
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
      reject(new Error(message));
    }
    
    function cleanupAndResolve(result: Array<{ timestamp: string; frame: Blob }>) {
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
      resolve(result);
    }
    
    // Start loading the video
    console.log(`Loading video from URL: ${videoUrl}`);
    video.src = videoUrl;
    
    // Force the video to load its metadata
    video.load();
  });
}
