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
    
    // Track load state
    let isVideoElementReady = false;
    
    // Array to store extracted frames
    const frames: Array<{ timestamp: string; frame: Blob }> = [];
    
    // Number of frames processed
    let framesProcessed = 0;
    
    // Create a canvas element for frame extraction
    const canvas = document.createElement("canvas");
    let ctx: CanvasRenderingContext2D | null = null;
    
    // Track failed extraction attempts to retry with a different approach
    const failedExtractions: string[] = [];
    
    // Setup complete promise to ensure we're fully ready before extraction
    const setupComplete = new Promise<void>((setupResolve) => {
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
                isVideoElementReady = true;
                setupResolve();
              } else {
                video.src = videoUrl; // Reload the video
                video.load(); // Force reload
              }
            }, 500);
          }).catch(err => {
            console.warn("Could not play video to get dimensions:", err);
            
            // Try manual size setting as fallback
            canvas.width = 1280; // Default HD width
            canvas.height = 720; // Default HD height
            ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
            isVideoElementReady = true;
            setupResolve();
          });
        } else {
          // Ensure canvas is properly sized
          if (!ctx || canvas.width <= 1 || canvas.height <= 1) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
          }
          
          isVideoElementReady = true;
          setupResolve();
        }
      }
      
      // Start the setup process
      setupVideoHandlers();
    });
    
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
            setTimeout(resolve, 50);
          }, 300);
        }).catch(() => {
          // If play fails, resolve anyway after a short delay
          setTimeout(resolve, 50);
        });
      });
    }
    
    // Extract frame with a preroll sequence to ensure decoder is ready
    function extractFrameWithPreroll(seconds: number, timestamp: string, callback: (success: boolean, frameBlob?: Blob) => void) {
      // Ensure video is set to specific quality options if possible
      try {
        // @ts-ignore - Some browsers support these properties
        if (video.videoWidth > 0 && video.hasOwnProperty('webkitDecodedFrameCount')) {
          // @ts-ignore - Force high quality decoding on webkit
          video.webkitPreservesPitch = true;
        }
      } catch (e) {
        // Ignore errors for unsupported browsers
      }

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
                }, 1500); // Increased delay for reliable frame loading
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
      
      // Use multiple capture techniques
      captureWithTechniques(timestamp, seconds, 0, callback);
    }
    
    // Try different capture techniques
    function captureWithTechniques(timestamp: string, seconds: number, techniqueIndex: number, callback: (success: boolean, frameBlob?: Blob) => void) {
      // Array of different capture techniques to try
      const techniques = [
        captureWithDrawImage,
        captureWithPlayPause,
        captureWithTimelapse,
        captureWithImageBitmap,
        captureWithColorCorrection
      ];
      
      if (techniqueIndex >= techniques.length) {
        console.warn(`All capture techniques failed for ${timestamp}`);
        callback(false);
        return;
      }
      
      // Try current technique
      techniques[techniqueIndex](timestamp, seconds, (success, frameBlob) => {
        if (success && frameBlob) {
          callback(true, frameBlob);
        } else {
          // Try next technique
          captureWithTechniques(timestamp, seconds, techniqueIndex + 1, callback);
        }
      });
    }
    
    // Basic capture with direct drawImage
    function captureWithDrawImage(timestamp: string, seconds: number, callback: (success: boolean, frameBlob?: Blob) => void) {
      if (!ctx) {
        callback(false);
        return;
      }
      
      console.log(`Trying basic drawImage capture for ${timestamp}`);
      
      try {
        // Clear the canvas
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Check frame quality
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const frameQuality = analyzeFrameQuality(imageData);
        
        if (frameQuality.score > 0.15) { // Good quality threshold
          // Apply contrast adjustment to prevent white frames
          applyFrameCorrections(ctx);
          
          canvas.toBlob((blob) => {
            if (blob && blob.size > 1000) { // Ensure blob has reasonable size
              callback(true, blob);
            } else {
              callback(false);
            }
          }, "image/jpeg", 0.95); // High quality JPEG
        } else {
          // Also try PNG for problematic frames
          // Apply stronger corrections for PNG
          applyFrameCorrections(ctx, true);
          
          canvas.toBlob((blob) => {
            if (blob && blob.size > 1000) { // Ensure blob has reasonable size
              console.log(`Used PNG format for ${timestamp} with quality ${frameQuality.score.toFixed(2)}`);
              callback(true, blob);
            } else {
              callback(false);
            }
          }, "image/png");
        }
      } catch (error) {
        console.error(`Error in basic capture for ${timestamp}:`, error);
        callback(false);
      }
    }
    
    // Capture with play-pause cycle
    function captureWithPlayPause(timestamp: string, seconds: number, callback: (success: boolean, frameBlob?: Blob) => void) {
      if (!ctx) {
        callback(false);
        return;
      }
      
      console.log(`Trying play-pause technique for ${timestamp}`);
      
      // Play briefly before capture
      video.play().then(() => {
        setTimeout(() => {
          video.pause();
          
          // Allow some time for rendering
          setTimeout(() => {
            try {
              // Clear and draw
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Check frame quality
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const frameQuality = analyzeFrameQuality(imageData);
              
              console.log(`Play-pause quality for ${timestamp}: ${frameQuality.score.toFixed(2)}`);
              
              if (frameQuality.score > 0.15) {
                // Apply stronger contrast adjustment
                applyFrameCorrections(ctx, true);
                
                canvas.toBlob((blob) => {
                  if (blob && blob.size > 1000) {
                    callback(true, blob);
                  } else {
                    callback(false);
                  }
                }, "image/jpeg", 0.95);
              } else {
                callback(false);
              }
            } catch (error) {
              console.error(`Error in play-pause capture for ${timestamp}:`, error);
              callback(false);
            }
          }, 100);
        }, 200);
      }).catch(err => {
        console.warn(`Could not play video for play-pause technique: ${err}`);
        callback(false);
      });
    }
    
    // Capture with timelapse technique (multiple frames)
    function captureWithTimelapse(timestamp: string, seconds: number, callback: (success: boolean, frameBlob?: Blob) => void) {
      if (!ctx) {
        callback(false);
        return;
      }
      
      console.log(`Trying timelapse technique for ${timestamp}`);
      
      // Try capturing multiple frames in sequence
      const frames: ImageData[] = [];
      const frameCount = 5;
      let capturedFrames = 0;
      
      function captureTimelapseFrame() {
        if (capturedFrames >= frameCount) {
          // Process captured frames to find the best one
          let bestFrame = null;
          let bestScore = 0;
          
          for (let i = 0; i < frames.length; i++) {
            const quality = analyzeFrameQuality(frames[i]);
            if (quality.score > bestScore) {
              bestScore = quality.score;
              bestFrame = frames[i];
            }
          }
          
          if (bestFrame && bestScore > 0.15) {
            console.log(`Found good timelapse frame with score ${bestScore.toFixed(2)}`);
            ctx.putImageData(bestFrame, 0, 0);
            
            // Apply stronger contrast adjustment for timelapse frames
            applyFrameCorrections(ctx, true);
            
            canvas.toBlob((blob) => {
              if (blob && blob.size > 1000) {
                callback(true, blob);
              } else {
                callback(false);
              }
            }, "image/jpeg", 0.95);
          } else {
            callback(false);
          }
          return;
        }
        
        // Draw current frame
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Store frame
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        frames.push(imageData);
        capturedFrames++;
        
        // Small time offset for next frame
        const offset = 0.1 * capturedFrames;
        video.currentTime = seconds + offset;
        
        // Wait for seek to complete
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          setTimeout(() => captureTimelapseFrame(), 100);
        };
        
        video.addEventListener('seeked', onSeeked);
      }
      
      // Start the timelapse capture
      captureTimelapseFrame();
    }
    
    // Capture using ImageBitmap API for potentially better rendering
    function captureWithImageBitmap(timestamp: string, seconds: number, callback: (success: boolean, frameBlob?: Blob) => void) {
      if (!ctx || !('createImageBitmap' in window)) {
        callback(false);
        return;
      }
      
      console.log(`Trying ImageBitmap technique for ${timestamp}`);
      
      try {
        createImageBitmap(video).then(bitmap => {
          // Draw the bitmap to canvas
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close(); // Release resources
          
          // Check quality
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const frameQuality = analyzeFrameQuality(imageData);
          
          console.log(`ImageBitmap quality for ${timestamp}: ${frameQuality.score.toFixed(2)}`);
          
          if (frameQuality.score > 0.15) {
            // Apply strong contrast/brightness adjustments
            applyFrameCorrections(ctx, true);
            
            canvas.toBlob((blob) => {
              if (blob && blob.size > 1000) {
                callback(true, blob);
              } else {
                callback(false);
              }
            }, "image/jpeg", 0.95);
          } else {
            callback(false);
          }
        }).catch(err => {
          console.warn(`ImageBitmap creation failed: ${err}`);
          callback(false);
        });
      } catch (error) {
        console.error(`Error in ImageBitmap capture: ${error}`);
        callback(false);
      }
    }
    
    // Capture with color correction
    function captureWithColorCorrection(timestamp: string, seconds: number, callback: (success: boolean, frameBlob?: Blob) => void) {
      if (!ctx) {
        callback(false);
        return;
      }
      
      console.log(`Trying color correction technique for ${timestamp}`);
      
      // Draw the video frame
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get the image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Apply direct pixel manipulation for stronger contrast adjustments
      // This works better for overly bright frames
      let totalBrightness = 0;
      
      // First calculate average brightness
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2]; 
        totalBrightness += (r + g + b) / 3;
      }
      
      const avgBrightness = totalBrightness / (data.length / 4) / 255;
      console.log(`Average brightness before correction: ${avgBrightness.toFixed(2)}`);
      
      // Apply appropriate correction based on brightness
      let contrastFactor = 1.2; // Default contrast boost
      let brightnessFactor = 0.0; // Default no brightness change
      
      if (avgBrightness > 0.85) {
        // Handle overly bright frames - reduce brightness and increase contrast
        contrastFactor = 1.5; 
        brightnessFactor = -30; // Darken the image
        console.log("Applying strong darkening for overly bright frame");
      } else if (avgBrightness > 0.7) {
        // Handle bright frames - moderate correction
        contrastFactor = 1.3;
        brightnessFactor = -20;
        console.log("Applying moderate darkening for bright frame");
      } else if (avgBrightness < 0.2) {
        // Handle dark frames - increase brightness
        contrastFactor = 1.3;
        brightnessFactor = 20;
        console.log("Applying brightness boost for dark frame");
      }
      
      // Apply pixel-level adjustments
      for (let i = 0; i < data.length; i += 4) {
        // Apply contrast
        for (let j = 0; j < 3; j++) {
          let color = data[i+j];
          // Apply contrast (centered at 128)
          color = Math.floor(((color / 255 - 0.5) * contrastFactor + 0.5) * 255);
          // Apply brightness
          color += brightnessFactor;
          // Clamp values
          data[i+j] = Math.max(0, Math.min(255, color));
        }
        
        // Check if pixel is close to white
        if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
          // Make sure white isn't pure white, to add texture
          data[i] = 230;     // R
          data[i+1] = 230;   // G
          data[i+2] = 235;   // B
        }
      }
      
      // Put the modified image data back on the canvas
      ctx.putImageData(imageData, 0, 0);
      
      // Create blob with higher quality setting
      canvas.toBlob((blob) => {
        if (blob && blob.size > 1000) {
          console.log(`Color correction technique produced a valid blob for ${timestamp}`);
          callback(true, blob);
        } else {
          callback(false);
        }
      }, "image/jpeg", 0.95);
    }
    
    // Helper function to apply contrast/brightness to already drawn frame
    function applyFrameCorrections(ctx: CanvasRenderingContext2D, strongCorrection: boolean = false) {
      // Get current frame from canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Calculate average brightness first
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i+1] + data[i+2]) / 3;
      }
      
      const avgBrightness = totalBrightness / (data.length / 4) / 255;
      
      // Adjust parameters based on current brightness
      let contrastAdjust = strongCorrection ? 1.4 : 1.2;
      let brightnessAdjust = 0;
      
      // Apply special handling for overly bright frames (common issue)
      if (avgBrightness > 0.85) {
        contrastAdjust = strongCorrection ? 1.6 : 1.4;
        brightnessAdjust = strongCorrection ? -35 : -25;
      } else if (avgBrightness > 0.7) {
        contrastAdjust = strongCorrection ? 1.5 : 1.3;
        brightnessAdjust = strongCorrection ? -25 : -15;
      } else if (avgBrightness < 0.2) {
        // Handle dark frames by brightening
        brightnessAdjust = strongCorrection ? 30 : 20;
      }
      
      // Apply adjustments
      for (let i = 0; i < data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          let color = data[i + j];
          
          // Apply contrast centered at 128
          color = ((color / 255 - 0.5) * contrastAdjust + 0.5) * 255;
          
          // Apply brightness
          color += brightnessAdjust;
          
          // Clamp values
          data[i + j] = Math.max(0, Math.min(255, color));
        }
      }
      
      // Apply the modified data back to canvas
      ctx.putImageData(imageData, 0, 0);
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
      let whiteCount = 0;
      
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
        
        // Count near-white pixels (for detecting blank frames)
        if (r > 250 && g > 250 && b > 250) {
          whiteCount++;
        }
        
        // Calculate color variance
        colorVariance += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
        
        // If we find significant non-white, non-black content, we're good
        if ((r < 240 || g < 240 || b < 240) && (r > 15 || g > 15 || b > 15)) {
          hasContent = true;
        }
      }
      
      const sampledPixels = Math.ceil(pixelCount / step);
      const avgBrightness = totalBrightness / (sampledPixels * 255);
      const midPixelRatio = midPixels / sampledPixels;
      const colorVarianceScore = colorVariance / (sampledPixels * 765); // 765 is max possible variance (255*3)
      const whiteRatio = whiteCount / sampledPixels;
      
      // Penalize heavily if frame is almost all white
      const whiteFramePenalty = whiteRatio > 0.95 ? 0.1 : 1.0;
      
      console.log(`Frame quality: brightness=${avgBrightness.toFixed(2)}, ` +
                  `midPixels=${midPixelRatio.toFixed(2)}, ` +
                  `colorVar=${colorVarianceScore.toFixed(2)}, ` +
                  `whiteRatio=${whiteRatio.toFixed(2)}, ` +
                  `hasContent=${hasContent}`);
      
      // Calculate quality score - higher is better
      // We prefer:
      // 1. Medium brightness (around 0.5) - distance from ideal of 0.5
      // 2. High mid-range pixel content
      // 3. High color variance
      const brightnessFactor = 1 - Math.abs(avgBrightness - 0.5) * 2; // 1 at perfect, 0 at extremes
      
      // Combined quality score (weighted sum)
      const qualityScore = (
        brightnessFactor * 0.4 + 
        midPixelRatio * 0.4 + 
        colorVarianceScore * 0.2
      ) * whiteFramePenalty * (hasContent ? 1 : 0.5);
      
      return {
        score: qualityScore,
        brightness: avgBrightness,
        midPixelRatio,
        colorVariance: colorVarianceScore,
        whiteRatio,
        hasContent
      };
    }
    
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
    
    // Start loading the video
    console.log(`Loading video from URL: ${videoUrl}`);
    video.src = videoUrl;
    
    // Force the video to load
    video.load();
    
    // Wait for setup to complete and then begin processing
    setupComplete.then(() => {
      // Initialize extraction with a brief preroll play to get the decoder warmed up
      video.play().then(() => {
        setTimeout(() => {
          video.pause();
          // Start processing timestamps
          processTimestamps();
        }, 1000); // 1 second preroll
      }).catch(err => {
        console.warn("Could not perform initial play for decoder warmup:", err);
        // Start processing anyway
        processTimestamps();
      });
    }).catch(err => {
      console.error("Setup failed:", err);
      cleanupAndReject("Failed to set up video element");
    });
  });
}
