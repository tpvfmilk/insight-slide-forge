import { toast } from "sonner";

interface ExtractionOptions {
  captureAttempts?: number;
  captureOffsets?: number[];
  minContentThreshold?: number;
  logProgress?: boolean;
  useCanvas2D?: boolean;
}

interface FrameQuality {
  brightness: number;
  colorVariance: number;
  midtonePixels: number;
  whiteRatio: number;
  blackRatio: number;
  hasContent: boolean;
}

/**
 * Extract frames from a video URL at specific timestamps
 * @param videoUrl URL of the video to extract frames from
 * @param timestamps Array of timestamp strings in "MM:SS" format
 * @param progressCallback Optional callback function that reports progress
 * @param videoDuration Optional known duration of the video in seconds
 * @param options Additional extraction options
 * @returns Promise resolving to an array of extracted frames
 */
export const extractFramesFromVideoUrl = async (
  videoUrl: string,
  timestamps: string[],
  progressCallback?: (completed: number, total: number) => void,
  videoDuration?: number,
  options: ExtractionOptions = {}
): Promise<Array<{ timestamp: string; frame: Blob }>> => {
  console.log(`Loading video from URL: ${videoUrl}`);
  
  // Filter out any invalid timestamps
  const validTimestamps = timestamps.filter((ts) => ts && typeof ts === "string");
  if (validTimestamps.length === 0) {
    throw new Error("No valid timestamps provided");
  }
  
  console.log(`Processing ${validTimestamps.length} valid timestamps out of ${timestamps.length} provided`);
  console.log(`Processing ${validTimestamps.length} timestamps: ${validTimestamps.join(", ")}`);
  
  // Set default options
  const defaultOptions: Required<ExtractionOptions> = {
    captureAttempts: 5,
    captureOffsets: [-0.1, 0, 0.1, 0.2, -0.2, 0.3, -0.3, 0.5, -0.5],
    minContentThreshold: 0.05,
    logProgress: true,
    useCanvas2D: true
  };
  
  const extractionOptions: Required<ExtractionOptions> = {
    ...defaultOptions,
    ...options
  };
  
  // Create a video element
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  
  // Create a canvas for frame extraction
  const canvas = document.createElement("canvas");
  canvas.width = 1920; // Default dimensions, will be updated when video loads
  canvas.height = 1080;
  
  try {
    // Load the video
    const videoLoadPromise = new Promise<void>((resolve, reject) => {
      let metadataLoaded = false;
      let videoLoaded = false;
      
      // Handle metadata loaded
      video.onloadedmetadata = () => {
        metadataLoaded = true;
        console.log(`Video metadata loaded. Duration: ${video.duration}s, Dimensions: ${video.videoWidth}x${video.videoHeight}`);
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      };
      
      // Handle video data loaded
      video.onloadeddata = () => {
        videoLoaded = true;
        console.log(`Video loaded fully. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
        resolve();
      };
      
      // Handle errors
      video.onerror = (error) => {
        reject(new Error(`Failed to load video: ${error}`));
      };
      
      // Set timeout for loading
      const timeout = setTimeout(() => {
        if (!videoLoaded) {
          if (metadataLoaded) {
            // If metadata loaded but not full video, we can still try extraction
            console.warn("Video data not fully loaded, but metadata is available. Will attempt extraction anyway.");
            resolve();
          } else {
            reject(new Error("Video loading timed out"));
          }
        }
      }, 15000); // 15 second timeout
      
      // Set video source
      video.src = videoUrl;
      
      // Clean up timeout on resolution
      video.onloadeddata = () => {
        clearTimeout(timeout);
        videoLoaded = true;
        console.log(`Video loaded fully. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
        resolve();
      };
    });
    
    // Wait for video to load
    await videoLoadPromise;
    
    // Set up canvas for frame extraction
    const ctx = canvas.getContext("2d", { 
      alpha: false,
      desynchronized: true,
      willReadFrequently: true
    });
    
    if (!ctx) {
      throw new Error("Could not create canvas context");
    }
    
    // Get actual duration if not provided
    const actualDuration = video.duration;
    console.log(`Actual video duration: ${actualDuration}s`);
    
    // Apply contrast and brightness adjustments to the canvas
    ctx.filter = "contrast(1.2) brightness(0.95)"; // Slightly increase contrast and decrease brightness
    
    // Extract frames for each timestamp
    const extractedFrames: Array<{ timestamp: string; frame: Blob }> = [];
    
    for (let i = 0; i < validTimestamps.length; i++) {
      const timestamp = validTimestamps[i];
      const timeInSeconds = parseTimestamp(timestamp);
      
      console.log(`Extracting frame at timestamp ${timestamp} (${timeInSeconds}s), ${i + 1}/${validTimestamps.length}`);
      
      // Try multiple offsets and attempts for best frame
      let bestFrame: Blob | null = null;
      let bestQuality: FrameQuality | null = null;
      
      // Try different offsets from the target time
      for (const offset of extractionOptions.captureOffsets) {
        // Calculate actual time with offset (clamping to valid range)
        const actualTime = Math.max(0, Math.min(actualDuration, timeInSeconds + offset));
        console.log(`Trying extraction at ${timestamp} with offset ${offset}s (actual time: ${actualTime.toFixed(2)}s)`);
        
        for (let attempt = 1; attempt <= extractionOptions.captureAttempts; attempt++) {
          console.log(`Attempt ${attempt}/${extractionOptions.captureAttempts} for timestamp ${timestamp}`);
          
          try {
            // First seek to a point slightly before the target time for better accuracy
            const prerollTime = Math.max(0, actualTime - 1);
            video.currentTime = prerollTime;
            await new Promise<void>((resolve) => {
              const onSeeked = () => {
                video.removeEventListener("seeked", onSeeked);
                resolve();
              };
              video.addEventListener("seeked", onSeeked);
            });
            console.log(`Preroll: Seeked to ${prerollTime}s to prepare for timestamp ${timestamp}`);
            
            // Now seek to the actual time
            video.currentTime = actualTime;
            await new Promise<void>((resolve) => {
              const onSeeked = () => {
                video.removeEventListener("seeked", onSeeked);
                resolve();
              };
              video.addEventListener("seeked", onSeeked);
            });
            console.log(`Main: Seeked to ${actualTime}s for timestamp ${timestamp}`);

            // Try different capture methods
            let frame: Blob | null = null;
            
            // Method 1: Basic drawImage
            try {
              console.log(`Trying basic drawImage capture for ${timestamp}`);
              ctx.drawImage(video, 0, 0);
              
              // Check frame quality
              const quality = assessFrameQuality(ctx, canvas);
              console.log(`Frame quality: brightness=${quality.brightness.toFixed(2)}, midPixels=${quality.midtonePixels.toFixed(2)}, colorVar=${quality.colorVariance.toFixed(2)}, whiteRatio=${quality.whiteRatio.toFixed(2)}, hasContent=${quality.hasContent}`);

              // If this is a good quality frame or we don't have a better one yet
              if (quality.hasContent && (!bestQuality || quality.midtonePixels > bestQuality.midtonePixels)) {
                frame = await canvasToBlob(canvas, quality);
                bestQuality = quality;
                bestFrame = frame;
                
                // If we have a really good frame, break early
                if (quality.midtonePixels > 0.4 && quality.whiteRatio < 0.2) {
                  break;
                }
              }
            } catch (captureError) {
              console.error(`Basic capture failed for ${timestamp}:`, captureError);
            }
            
            // Method 2: Play-pause method (might help with some videos)
            if (!bestFrame || (bestQuality && bestQuality.midtonePixels < 0.2)) {
              try {
                console.log(`Trying play-pause method for ${timestamp}`);
                video.currentTime = actualTime - 0.1;
                await video.play();
                await new Promise(r => setTimeout(r, 100)); // Play briefly
                video.pause();
                
                // Wait for pause to take effect
                await new Promise(r => setTimeout(r, 50));
                
                // Draw frame after pause
                ctx.drawImage(video, 0, 0);
                
                // Check frame quality
                const quality = assessFrameQuality(ctx, canvas);
                
                if (quality.hasContent && (!bestQuality || quality.midtonePixels > bestQuality.midtonePixels)) {
                  frame = await canvasToBlob(canvas, quality);
                  bestQuality = quality;
                  bestFrame = frame;
                }
              } catch (playError) {
                console.warn(`Play-pause capture failed for ${timestamp}:`, playError);
              }
            }
            
            // Method 3: ImageBitmap rendering (more hardware accelerated)
            if (!bestFrame || (bestQuality && bestQuality.midtonePixels < 0.2)) {
              try {
                console.log(`Trying ImageBitmap method for ${timestamp}`);
                const bitmap = await createImageBitmap(video);
                ctx.drawImage(bitmap, 0, 0);
                bitmap.close();
                
                // Check frame quality
                const quality = assessFrameQuality(ctx, canvas);
                
                if (quality.hasContent && (!bestQuality || quality.midtonePixels > bestQuality.midtonePixels)) {
                  frame = await canvasToBlob(canvas, quality);
                  bestQuality = quality;
                  bestFrame = frame;
                }
              } catch (bitmapError) {
                console.warn(`ImageBitmap capture failed for ${timestamp}:`, bitmapError);
              }
            }
            
            // Method 4: Try applying color correction in post-processing
            if (!bestFrame || (bestQuality && bestQuality.whiteRatio > 0.5)) {
              try {
                console.log(`Applying post-processing for ${timestamp}`);
                // Save current canvas content
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Apply stronger contrast/brightness adjustments
                applyContrastAndBrightness(imageData, 1.4, -20); // Stronger contrast and reduced brightness
                
                // Put back the modified image data
                ctx.putImageData(imageData, 0, 0);
                
                // Check frame quality after processing
                const quality = assessFrameQuality(ctx, canvas);
                
                if (quality.hasContent && (!bestQuality || quality.midtonePixels > bestQuality.midtonePixels)) {
                  frame = await canvasToBlob(canvas, quality);
                  bestQuality = quality;
                  bestFrame = frame;
                }
              } catch (processingError) {
                console.warn(`Post-processing failed for ${timestamp}:`, processingError);
              }
            }
            
            if (bestFrame && bestQuality && bestQuality.hasContent) {
              // We got a good enough frame, stop trying
              break;
            }
          } catch (error) {
            console.error(`Error capturing frame at ${timestamp} (attempt ${attempt}):`, error);
          }
        }
      }
      
      // If we found a frame with content, use it
      if (bestFrame && bestQuality && bestQuality.hasContent) {
        extractedFrames.push({ timestamp, frame: bestFrame });
      } else {
        // If all attempts failed or produced blank frames, try a fallback approach
        console.warn(`All attempts to extract a good frame at ${timestamp} failed. Using fallback approach.`);
        try {
          // Set video to specified time
          video.currentTime = timeInSeconds;
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              resolve();
            };
            video.addEventListener("seeked", onSeeked);
          });
          
          // Clear any filters
          ctx.filter = "none";
          
          // Draw the frame
          ctx.drawImage(video, 0, 0);
          
          // Force saturation and contrast in post-processing
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          applyContrastAndBrightness(imageData, 1.5, -25);
          ctx.putImageData(imageData, 0, 0);
          
          // Create blob with forced JPEG encoding (which might preserve more detail than PNG for low contrast)
          const fallbackFrame = await new Promise<Blob>((resolve) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else resolve(new Blob(["fallback"], { type: "image/jpeg" }));
              },
              "image/jpeg",
              0.95
            );
          });
          
          extractedFrames.push({ timestamp, frame: fallbackFrame });
        } catch (fallbackError) {
          console.error(`Fallback frame extraction failed for ${timestamp}:`, fallbackError);
        }
      }
      
      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, validTimestamps.length);
      }
    }
    
    console.log(`Successfully extracted ${extractedFrames.length} frames from video`);
    return extractedFrames;
    
  } catch (error) {
    console.error("Error extracting frames:", error);
    throw error;
  } finally {
    // Clean up resources
    video.src = "";
    video.load();
  }
};

/**
 * Parse a timestamp string into seconds
 */
function parseTimestamp(timestamp: string): number {
  if (!timestamp) return 0;
  
  // Remove any whitespace
  timestamp = timestamp.trim();
  
  // Split the timestamp into parts
  const parts = timestamp.split(":");
  
  if (parts.length === 2) {
    // MM:SS format
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (!isNaN(parseFloat(timestamp))) {
    // Seconds format
    return parseFloat(timestamp);
  }
  
  return 0;
}

/**
 * Convert a canvas to a Blob, using appropriate format based on content
 */
async function canvasToBlob(canvas: HTMLCanvasElement, quality: FrameQuality): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    // Use PNG for better quality if there's detail, JPEG for more content
    let format = "image/jpeg";
    let compressionQuality = 0.9; // High quality by default
    
    if (quality.midtonePixels < 0.1 && quality.whiteRatio > 0.7) {
      format = "image/png";
      compressionQuality = 1.0; // Lossless for low content frames
      console.log(`Used PNG format for quality ${quality.midtonePixels.toFixed(2)}`);
    } else {
      compressionQuality = Math.min(0.95, Math.max(0.7, quality.midtonePixels * 2)); 
      console.log(`Used JPEG format for quality ${quality.midtonePixels.toFixed(2)} with compression ${compressionQuality.toFixed(2)}`);
    }
    
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Fallback to PNG if blob creation fails
          canvas.toBlob(
            (pngBlob) => {
              if (pngBlob) resolve(pngBlob);
              else resolve(new Blob(["fallback"], { type: "image/png" }));
            },
            "image/png"
          );
        }
      },
      format,
      compressionQuality
    );
  });
}

/**
 * Apply contrast and brightness adjustments to ImageData
 * @param imageData The ImageData object to modify
 * @param contrast Contrast adjustment factor (1.0 = no change, >1 = more contrast)
 * @param brightness Brightness adjustment (-255 to 255, 0 = no change)
 */
function applyContrastAndBrightness(imageData: ImageData, contrast: number, brightness: number) {
  const data = imageData.data;
  
  // Normalize contrast to factor
  const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
  
  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast
    data[i] = truncate(factor * (data[i] - 128) + 128 + brightness);
    data[i + 1] = truncate(factor * (data[i + 1] - 128) + 128 + brightness);
    data[i + 2] = truncate(factor * (data[i + 2] - 128) + 128 + brightness);
    // Alpha channel remains unchanged
  }
}

/**
 * Ensure color values stay within 0-255 range
 */
function truncate(value: number): number {
  return Math.max(0, Math.min(255, value));
}

/**
 * Calculate frame quality metrics to detect blank/white frames
 */
function assessFrameQuality(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): FrameQuality {
  // Get image data from the canvas
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const pixelCount = canvas.width * canvas.height;
  
  // Skip pixels for performance on large images
  const skipFactor = Math.max(1, Math.floor(pixelCount / 50000));
  
  let totalBrightness = 0;
  let midtonePixels = 0;
  let whitePixels = 0;
  let blackPixels = 0;
  let redTotal = 0, greenTotal = 0, blueTotal = 0;
  
  // Sample across the image
  for (let i = 0; i < data.length; i += 4 * skipFactor) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Calculate pixel brightness (0-1)
    const brightness = (r + g + b) / (3 * 255);
    totalBrightness += brightness;
    
    // Count midtone pixels (not too dark, not too bright)
    if (brightness > 0.15 && brightness < 0.85) {
      midtonePixels++;
    }
    
    // Count white pixels
    if (brightness > 0.85) {
      whitePixels++;
    }
    
    // Count black pixels
    if (brightness < 0.15) {
      blackPixels++;
    }
    
    // Track color components for variance calculation
    redTotal += r;
    greenTotal += g;
    blueTotal += b;
  }
  
  // Normalize to 0-1 range
  const sampledPixels = Math.ceil(pixelCount / skipFactor);
  const averageBrightness = totalBrightness / sampledPixels;
  const midtoneRatio = midtonePixels / sampledPixels;
  const whiteRatio = whitePixels / sampledPixels;
  const blackRatio = blackPixels / sampledPixels;
  
  // Calculate color variance (higher means more diverse colors)
  const redAvg = redTotal / sampledPixels;
  const greenAvg = greenTotal / sampledPixels;
  const blueAvg = blueTotal / sampledPixels;
  
  let colorVariance = 0;
  // Calculate color variance by sampling pixels again
  for (let i = 0; i < data.length; i += 4 * skipFactor * 2) { // Sample even fewer pixels for variance
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const rDiff = r - redAvg;
    const gDiff = g - greenAvg;
    const bDiff = b - blueAvg;
    
    // Add to cumulative variance
    colorVariance += (rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
  }
  // Normalize variance
  colorVariance = Math.sqrt(colorVariance / sampledPixels) / 255;
  
  // Determine if frame has useful content
  const hasContent = (
    midtoneRatio > 0.05 || // Has some midtones
    colorVariance > 0.02 || // Has some color variation
    whiteRatio < 0.9 // Not mostly white
  );
  
  return {
    brightness: averageBrightness,
    midtonePixels: midtoneRatio,
    colorVariance: colorVariance,
    whiteRatio: whiteRatio,
    blackRatio: blackRatio,
    hasContent: hasContent
  };
}
