
import { timestampToSeconds } from "./formatUtils";

/**
 * Extract frames from a video at specific timestamps
 * @param videoUrl URL of the video
 * @param timestamps Array of timestamps as strings in the format "HH:MM:SS"
 * @param progressCallback Optional callback function to report progress
 * @param videoDuration Optional video duration to validate timestamps
 * @param options Optional configuration for extraction behavior
 * @returns Array of objects containing extracted frame as Blob and the corresponding timestamp
 */
export async function extractFramesFromVideoUrl(
  videoUrl: string,
  timestamps: string[],
  progressCallback?: (completed: number, total: number) => void,
  videoDuration?: number,
  options?: {
    captureAttempts?: number;
    captureOffsets?: number[];
    minContentThreshold?: number;
  }
): Promise<Array<{ timestamp: string; frame: Blob }>> {
  // Set defaults for options
  const captureAttempts = options?.captureAttempts || 3;
  const captureOffsets = options?.captureOffsets || [-0.2, 0, 0.2, 0.5, -0.5, 0.8, -1.0, 1.0];
  const minContentThreshold = options?.minContentThreshold || 0.05; // Lower threshold to detect content
  
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous"; // Enable CORS for the video
    video.playsInline = true;
    video.muted = true;
    video.preload = "auto"; // Force full preload
    video.volume = 0; // Ensure it's silent
    
    // Add more video attributes to help with loading
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    
    // Prevent video from showing in the DOM and causing UI shifts
    video.style.position = "absolute";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.height = "1px";
    video.style.width = "1px";
    video.style.visibility = "hidden";
    
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
    
    // Set up video event handlers with more reliable loading sequence
    const setupVideoHandlers = () => {
      video.onloadedmetadata = function() {
        console.log(`Video metadata loaded. Duration: ${video.duration}s, Dimensions: ${video.videoWidth}x${video.videoHeight}`);
        
        // Set canvas dimensions as soon as we know video size
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx = canvas.getContext("2d", { 
            alpha: false, // No transparency needed
            willReadFrequently: true // Optimize for pixel reading
          });
        }
        
        video.onloadeddata = onVideoFullyLoaded;
      };
    };
    
    function onVideoFullyLoaded() {
      console.log(`Video loaded fully. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
      
      // Verify we have a valid video size before proceeding
      if (video.videoWidth <= 1 || video.videoHeight <= 1) {
        console.warn("Video dimensions are invalid, waiting for valid dimensions");
        
        // Try playing briefly to force dimensions to update
        video.play().then(() => {
          setTimeout(() => {
            video.pause();
            
            if (video.videoWidth > 1 && video.videoHeight > 1) {
              // Now we have valid dimensions
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
              initializeProcessing();
            } else {
              cleanupAndReject("Could not get valid video dimensions");
            }
          }, 500);
        }).catch(err => {
          console.warn("Could not play video to get dimensions:", err);
          cleanupAndReject("Failed to initialize video playback");
        });
      } else {
        // Ensure canvas is properly sized
        if (!ctx || canvas.width <= 1 || canvas.height <= 1) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
        }
        
        initializeProcessing();
      }
    }
    
    function initializeProcessing() {
      if (!ctx) {
        cleanupAndReject("Failed to get canvas context");
        return;
      }
      
      // Play video briefly to ensure decoder is initialized
      video.play().then(() => {
        // Let it play for a bit to ensure decoder is fully initialized
        setTimeout(() => {
          video.pause();
          processTimestamps();
        }, 1000); // Longer preroll to better initialize video decoder
      }).catch(err => {
        console.warn("Could not play video to initialize:", err);
        // Try to continue anyway
        processTimestamps();
      });
    }
    
    function processTimestamps() {
      // Get actual video duration from the loaded video
      const actualVideoDuration = video.duration;
      console.log(`Actual video duration: ${actualVideoDuration}s`);
      
      if (!Number.isFinite(actualVideoDuration) || actualVideoDuration <= 0) {
        console.warn("Invalid video duration detected, using provided duration or default");
      }
      
      // Filter timestamps that exceed video duration
      // Use the provided videoDuration parameter if available, otherwise use the actual duration from the video
      const maxDuration = videoDuration || actualVideoDuration || 3600; // Fallback to 1 hour if no duration
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
      
      // Process timestamps one by one to avoid race conditions
      processNextTimestamp(uniqueTimestamps, 0);
    }
    
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
      
      // Try multiple offset positions for extraction
      tryExtractWithOffsets(seconds, currentTimestamp, captureOffsets, 0);
    }
    
    // Try extraction with different time offsets
    function tryExtractWithOffsets(baseSeconds: number, timestamp: string, offsets: number[], offsetIndex: number) {
      if (offsetIndex >= offsets.length) {
        console.warn(`All offset attempts failed for timestamp ${timestamp}`);
        failedExtractions.push(timestamp);
        processNextTimestamp(timestamps, timestamps.indexOf(timestamp) + 1);
        return;
      }
      
      const offset = offsets[offsetIndex];
      const targetSeconds = Math.max(0, baseSeconds + offset);
      
      console.log(`Trying extraction at ${timestamp} with offset ${offset}s (actual time: ${targetSeconds.toFixed(2)}s)`);
      
      // Try multiple attempts at this offset
      tryMultipleExtractionAttempts(targetSeconds, timestamp, 0, captureAttempts, () => {
        // If this offset fails, try the next offset
        tryExtractWithOffsets(baseSeconds, timestamp, offsets, offsetIndex + 1);
      });
    }
    
    // Try multiple attempts at extracting a single timestamp
    function tryMultipleExtractionAttempts(
      seconds: number, 
      timestamp: string, 
      attemptCount: number, 
      maxAttempts: number,
      onAllAttemptsFailed: () => void
    ) {
      if (attemptCount >= maxAttempts) {
        console.warn(`All ${maxAttempts} attempts failed for timestamp ${timestamp} at ${seconds}s`);
        onAllAttemptsFailed();
        return;
      }
      
      console.log(`Attempt ${attemptCount + 1}/${maxAttempts} for timestamp ${timestamp}`);
      
      // Add small variation to time position for different attempts
      const variationOffset = attemptCount * 0.04; // Small incremental offset
      const targetTime = seconds + variationOffset;
      
      // Extract frame with preroll
      extractFrameWithPreroll(targetTime, timestamp, (success, frameBlob) => {
        if (success && frameBlob) {
          // We got a good frame
          frames.push({
            timestamp,
            frame: frameBlob
          });
          
          // Update progress
          framesProcessed++;
          if (progressCallback) {
            progressCallback(framesProcessed, timestamps.length);
          }
          
          // Move to next timestamp
          processNextTimestamp(timestamps, timestamps.indexOf(timestamp) + 1);
        } else {
          // Try next attempt
          tryMultipleExtractionAttempts(seconds, timestamp, attemptCount + 1, maxAttempts, onAllAttemptsFailed);
        }
      });
    }
    
    // Forcefully render a frame by playing video
    function forceFrameRender(): Promise<void> {
      return new Promise((resolve) => {
        // Try to play for a very short time to force rendering
        video.play().then(() => {
          setTimeout(() => {
            video.pause();
            // Allow a bit of time for the pause to take effect
            setTimeout(resolve, 20);
          }, 100);
        }).catch(() => {
          // If play fails, resolve anyway after a short delay
          setTimeout(resolve, 50);
        });
      });
    }
    
    // Extract frame with a preroll sequence to ensure decoder is ready
    function extractFrameWithPreroll(seconds: number, timestamp: string, callback: (success: boolean, frameBlob?: Blob) => void) {
      // Seek to slightly before the target time
      const prerollTime = Math.max(0, seconds - 1.0);
      
      // Use requestAnimationFrame for more reliable timing
      requestAnimationFrame(() => {
        video.currentTime = prerollTime;
      });
      
      // Handle the 'seeked' event for preroll position
      const handlePrerollSeeked = function() {
        // Remove event listener to avoid multiple callbacks
        video.removeEventListener('seeked', handlePrerollSeeked);
        
        console.log(`Preroll: Seeked to ${video.currentTime}s to prepare for timestamp ${timestamp}`);
        
        // Play briefly from the preroll position
        video.play().then(() => {
          // Play for a short time then pause
          setTimeout(() => {
            video.pause();
            
            // Now seek to the actual target time
            setTimeout(() => {
              requestAnimationFrame(() => {
                video.currentTime = seconds;
              });
              
              // Set up event listener for the main seek
              const handleMainSeeked = function() {
                video.removeEventListener('seeked', handleMainSeeked);
                console.log(`Main: Seeked to ${video.currentTime}s for timestamp ${timestamp}`);
                
                // Wait with a longer delay to ensure the frame is fully loaded
                setTimeout(() => {
                  // Force frame render with a brief play/pause
                  forceFrameRender().then(() => {
                    captureAndAnalyzeFrame(timestamp, seconds, callback);
                  });
                }, 1200); // Increased delay for reliable frame loading
              };
              
              // Add event listener for the main seek
              video.addEventListener('seeked', handleMainSeeked);
            }, 100);
          }, 300); // Short play duration for preroll
        }).catch(() => {
          console.warn("Could not play video for preroll, attempting direct capture");
          
          // Try direct capture if playing fails
          requestAnimationFrame(() => {
            video.currentTime = seconds;
          });
          
          const handleDirectSeeked = function() {
            video.removeEventListener('seeked', handleDirectSeeked);
            
            setTimeout(() => {
              captureAndAnalyzeFrame(timestamp, seconds, callback);
            }, 1200);
          };
          
          video.addEventListener('seeked', handleDirectSeeked);
        });
      };
      
      // Add event listener for the preroll seek
      video.addEventListener('seeked', handlePrerollSeeked);
    }
    
    // Capture and analyze a frame, trying multiple techniques if needed
    function captureAndAnalyzeFrame(timestamp: string, seconds: number, callback: (success: boolean, frameBlob?: Blob) => void) {
      if (!ctx) {
        console.error("Canvas context is null");
        callback(false);
        return;
      }
      
      // Force a frame render with play/pause cycle
      forceFrameRender().then(() => {
        // Clear the canvas before drawing new content
        ctx!.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw solid background to avoid transparency issues
        ctx!.fillStyle = "white";
        ctx!.fillRect(0, 0, canvas.width, canvas.height);
        
        try {
          // Draw the current frame on the canvas
          ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Check if canvas is actually rendering content
          const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
          const frameQuality = analyzeFrameQuality(imageData);
          
          console.log(`Frame quality for ${timestamp}: score=${frameQuality.score.toFixed(2)}, ` +
                      `brightness=${frameQuality.brightness.toFixed(2)}, ` +
                      `midPixelRatio=${frameQuality.midPixelRatio.toFixed(2)}, ` +
                      `colorVar=${frameQuality.colorVariance.toFixed(2)}`);
          
          if (frameQuality.score > 0.15) {
            // Good quality frame - convert to blob
            canvas.toBlob((blob) => {
              if (blob && blob.size > 1000) { // Ensure blob has reasonable size
                callback(true, blob);
              } else {
                console.warn(`Generated blob for ${timestamp} is too small: ${blob?.size || 0} bytes`);
                callback(false);
              }
            }, "image/jpeg", 0.98); // Higher quality JPEG
          } else {
            // Try with a different compression method
            canvas.toBlob((blob) => {
              if (blob && blob.size > 1000) {
                callback(true, blob);
              } else {
                console.warn(`Low quality frame at ${timestamp}, score: ${frameQuality.score.toFixed(2)}`);
                callback(false);
              }
            }, "image/png"); // Try PNG format instead
          }
        } catch (error) {
          console.error(`Error drawing video to canvas at ${timestamp}:`, error);
          callback(false);
        }
      });
    }
    
    // Analyze frame quality and return score with metrics
    function analyzeFrameQuality(imageData: ImageData) {
      const pixelCount = imageData.data.length / 4;
      const sampleSize = Math.min(3000, pixelCount); // Increased sample size
      const step = Math.max(1, Math.floor(pixelCount / sampleSize));
      
      let totalBrightness = 0;
      let darkPixels = 0;
      let midPixels = 0;
      let brightPixels = 0;
      let colorVariance = 0;
      let hasContent = false;
      
      for (let i = 0; i < imageData.data.length; i += 4 * step) {
        const r = imageData.data[i];
        const g = imageData.data[i+1];
        const b = imageData.data[i+2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
        
        // Track pixels in different brightness ranges
        if (brightness < 40) darkPixels++;
        else if (brightness > 215) brightPixels++;
        else midPixels++;
        
        // Calculate color variance
        colorVariance += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
        
        // Check for non-white, non-black content
        if ((r < 240 || g < 240 || b < 240) && (r > 15 || g > 15 || b > 15)) {
          hasContent = true;
        }
      }
      
      const sampledPixels = Math.ceil(pixelCount / step);
      const avgBrightness = totalBrightness / (sampledPixels * 255);
      const midPixelRatio = midPixels / sampledPixels;
      const colorVarianceScore = colorVariance / (sampledPixels * 765);
      
      // Calculate quality score - higher is better
      const brightnessFactor = 1 - Math.abs(avgBrightness - 0.5) * 2; // 1 at perfect, 0 at extremes
      
      // Combined quality score (weighted sum)
      const qualityScore = (
        brightnessFactor * 0.4 + 
        midPixelRatio * 0.4 + 
        colorVarianceScore * 0.2
      ) * (hasContent ? 1 : 0.2); // Heavily penalize frames with no content
      
      return {
        score: qualityScore,
        brightness: avgBrightness,
        midPixelRatio,
        colorVariance: colorVarianceScore,
        hasContent
      };
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
      
      console.log(`Retrying extraction at ${currentTimestamp} with final approach...`);
      
      // Create a placeholder for this timestamp
      createPlaceholderFrame(currentTimestamp, (blob) => {
        frames.push({
          timestamp: currentTimestamp,
          frame: blob
        });
        
        // Update progress
        framesProcessed++;
        if (progressCallback) {
          progressCallback(framesProcessed, timestamps.length);
        }
        
        // Process next failed extraction
        retryFailedExtractions(failedTimestamps, index + 1);
      });
    }
    
    // Create a placeholder frame with text when all extraction attempts fail
    function createPlaceholderFrame(currentTimestamp: string, onComplete: (blob: Blob) => void) {
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
            onComplete(blob);
          } else {
            // Create a simple blue rectangle if blob creation fails
            const fallbackCanvas = document.createElement('canvas');
            fallbackCanvas.width = 640;
            fallbackCanvas.height = 360;
            const fallbackCtx = fallbackCanvas.getContext('2d');
            if (fallbackCtx) {
              fallbackCtx.fillStyle = "#2563eb";
              fallbackCtx.fillRect(0, 0, 640, 360);
              fallbackCtx.fillStyle = "white";
              fallbackCtx.font = "20px Arial";
              fallbackCtx.textAlign = "center";
              fallbackCtx.fillText(`Frame at ${currentTimestamp}`, 320, 170);
              fallbackCtx.fillText("unavailable", 320, 200);
              
              fallbackCanvas.toBlob((fallbackBlob) => {
                if (fallbackBlob) {
                  onComplete(fallbackBlob);
                } else {
                  // Create an empty blob if all else fails
                  onComplete(new Blob(["placeholder"], { type: 'text/plain' }));
                }
              });
            } else {
              // Last resort - text blob
              onComplete(new Blob(["placeholder"], { type: 'text/plain' }));
            }
          }
        }, "image/jpeg", 0.95);
      } else {
        // If no context, create simple blob
        onComplete(new Blob(["placeholder"], { type: 'text/plain' }));
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
    
    // Start the process
    setupVideoHandlers();
    
    // Start loading the video - with a more robust loading process
    try {
      console.log(`Loading video from URL: ${videoUrl}`);
      video.src = videoUrl;
      
      // Force the video to load
      video.load();
      
      // Set a timeout to detect video loading issues
      const loadingTimeout = setTimeout(() => {
        if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
          console.warn("Video loading timeout - readyState:", video.readyState);
          
          // Try to recover by forcing load again
          video.load();
          
          // Set a final timeout before giving up
          setTimeout(() => {
            if (video.readyState < 2) {
              cleanupAndReject("Video loading timed out");
            }
          }, 10000);
        }
      }, 15000);
      
      // Clear timeout if video loads successfully
      video.addEventListener('loadeddata', () => {
        clearTimeout(loadingTimeout);
      });
    } catch (e) {
      cleanupAndReject(`Error loading video: ${e}`);
    }
  });
}
