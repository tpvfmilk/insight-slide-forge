/**
 * Utility for extracting frames from videos using the HTML5 Video API
 */

/**
 * Converts a timestamp string (HH:MM:SS) to seconds
 * @param timestamp Timestamp in HH:MM:SS format
 * @returns Number of seconds
 */
export const timestampToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(':');
  
  if (parts.length === 3) {
    // HH:MM:SS format
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // MM:SS format
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  }
  
  // If format is not recognized, try parsing as seconds
  return parseFloat(timestamp);
};

/**
 * Checks if a frame is likely black or empty
 * @param context Canvas 2D context with frame drawn
 * @param threshold Darkness threshold (0-255, lower means darker)
 * @returns Boolean indicating if the frame is black
 */
export const isBlackFrame = (
  context: CanvasRenderingContext2D, 
  width: number,
  height: number,
  threshold: number = 20
): boolean => {
  // Sample pixels from the frame to determine if it's black
  // We'll check a few points rather than the entire frame for performance
  const sampleSize = Math.min(100, Math.floor(width * height / 100));
  const samplePoints = [];
  
  // Create sampling points spread across the frame
  for (let i = 0; i < sampleSize; i++) {
    samplePoints.push({
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height)
    });
  }
  
  // Check the sample points
  let darkPixelCount = 0;
  for (const point of samplePoints) {
    const pixel = context.getImageData(point.x, point.y, 1, 1).data;
    const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
    if (brightness < threshold) {
      darkPixelCount++;
    }
  }
  
  // If more than 90% of pixels are dark, consider it a black frame
  return (darkPixelCount / sampleSize) > 0.9;
};

/**
 * Extracts a frame from a video at a specific timestamp
 * @param videoElement HTML Video element to extract from
 * @param timestamp Timestamp in seconds
 * @param maxRetries Maximum number of retry attempts
 * @returns Promise resolving to a Blob of the extracted frame
 */
export const extractFrameFromVideo = (
  videoElement: HTMLVideoElement,
  timestamp: number,
  maxRetries: number = 3
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Log video element state for debugging
    console.log(`Extracting frame at ${timestamp}s. Video state:`, {
      readyState: videoElement.readyState,
      paused: videoElement.paused,
      currentTime: videoElement.currentTime,
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      crossOrigin: videoElement.crossOrigin,
    });
    
    let retryCount = 0;
    
    const attemptExtraction = () => {
      // Set the current time of the video to the requested timestamp
      videoElement.currentTime = timestamp;
      
      const seekTimeout = setTimeout(() => {
        if (retryCount < maxRetries) {
          console.warn(`Seek timeout at ${timestamp}s, retrying (${retryCount + 1}/${maxRetries})`);
          retryCount++;
          clearListeners();
          attemptExtraction();
        } else {
          reject(new Error(`Seek timeout at timestamp ${timestamp}s after ${maxRetries} attempts`));
        }
      }, 10000); // 10 second timeout for seeking
      
      const clearListeners = () => {
        clearTimeout(seekTimeout);
        videoElement.onseeked = null;
        videoElement.onerror = null;
      };
      
      // Wait for the video to seek to the specified timestamp
      videoElement.onseeked = () => {
        clearTimeout(seekTimeout);
        
        try {
          // Create a canvas element with the same dimensions as the video
          const canvas = document.createElement('canvas');
          const videoWidth = videoElement.videoWidth || 640;
          const videoHeight = videoElement.videoHeight || 360;
          
          // Double-check that we have valid dimensions
          if (videoWidth <= 0 || videoHeight <= 0) {
            if (retryCount < maxRetries) {
              console.warn(`Invalid video dimensions at ${timestamp}s, retrying (${retryCount + 1}/${maxRetries})`);
              retryCount++;
              clearListeners();
              setTimeout(attemptExtraction, 500); // Wait a bit before retrying
              return;
            } else {
              reject(new Error(`Invalid video dimensions at timestamp ${timestamp}s: ${videoWidth}x${videoHeight}`));
              return;
            }
          }
          
          canvas.width = videoWidth;
          canvas.height = videoHeight;
          
          // Draw the current frame to the canvas
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Try to draw the frame to canvas
          try {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // Check if it's a black frame
            if (isBlackFrame(ctx, canvas.width, canvas.height)) {
              if (retryCount < maxRetries) {
                console.warn(`Black frame detected at ${timestamp}s, retrying (${retryCount + 1}/${maxRetries})`);
                retryCount++;
                clearListeners();
                // Wait a bit longer before retry to ensure video is fully loaded
                setTimeout(attemptExtraction, 1000);
                return;
              }
              // Still black after retries, but we'll return it anyway as a fallback
              console.warn(`Black frame persisted at ${timestamp}s after ${maxRetries} attempts, returning anyway`);
            }
          } catch (drawError) {
            if (retryCount < maxRetries) {
              console.error(`Drawing error at ${timestamp}s, retrying (${retryCount + 1}/${maxRetries}):`, drawError);
              retryCount++;
              clearListeners();
              setTimeout(attemptExtraction, 500);
              return;
            }
            reject(new Error(`CORS error or failed to draw video frame: ${drawError.message}`));
            return;
          }
          
          // Convert the canvas to a blob
          canvas.toBlob((blob) => {
            if (blob) {
              console.log(`Successfully extracted frame at ${timestamp}s, blob size: ${blob.size} bytes`);
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          }, 'image/jpeg', 0.9); // JPEG with 90% quality
        } catch (error) {
          reject(error);
        }
      };
      
      // Handle errors
      videoElement.onerror = () => {
        clearTimeout(seekTimeout);
        reject(new Error(`Video error at timestamp ${timestamp}s: ${videoElement.error?.message || 'Unknown error'}`));
      };
    };
    
    attemptExtraction();
  });
};

/**
 * Creates a video element and loads a video from a URL
 * @param videoUrl URL of the video to load
 * @returns Promise resolving to a loaded video element
 */
export const createVideoElement = (videoUrl: string): Promise<HTMLVideoElement> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous'; // Required for canvas operations with cross-origin videos
    video.preload = 'auto';
    video.muted = true;
    
    // Enhanced CORS handling
    video.setAttribute('crossOrigin', 'anonymous');
    
    // Enable cors mode and prevent caching
    const corsUrl = new URL(videoUrl);
    corsUrl.searchParams.append('cors', 'true');
    corsUrl.searchParams.append('_cache', Date.now().toString());
    
    console.log(`Loading video from ${corsUrl.toString()} with enhanced CORS handling`);
    
    // Set up event handlers
    const loadTimeout = setTimeout(() => {
      console.error('Video loading timeout');
      reject(new Error('Video loading timeout after 30 seconds'));
    }, 30000); // 30 second timeout
    
    const handleVideoReady = () => {
      clearTimeout(loadTimeout);
      
      // Force the video to load a bit more content
      video.currentTime = 0.1;
      
      // Check if video dimensions are available
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        console.log(`Video loaded successfully. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
        resolve(video);
      } else {
        console.warn('Video loaded but dimensions not available, waiting for loadeddata');
        video.addEventListener('loadeddata', () => {
          console.log(`Video data loaded. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
          resolve(video);
        }, { once: true });
      }
    };
    
    video.addEventListener('loadedmetadata', () => {
      console.log('Video metadata loaded, dimensions might not be available yet');
      
      // Try to get dimensions right away if possible
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        handleVideoReady();
      } else {
        // Otherwise wait for loadeddata event
        video.addEventListener('loadeddata', handleVideoReady, { once: true });
      }
    }, { once: true });
    
    video.addEventListener('error', () => {
      clearTimeout(loadTimeout);
      const errorMessage = video.error ? `Video error: ${video.error.code} - ${video.error.message}` : 'Unknown video error';
      console.error(errorMessage);
      reject(new Error(`Failed to load video: ${errorMessage}`));
    }, { once: true });
    
    // Set the source and start loading
    video.src = corsUrl.toString();
    video.load();
  });
};

/**
 * Extract frames from a video URL at specific timestamps
 * @param videoUrl URL of the video to extract frames from
 * @param timestamps Array of timestamps in format "HH:MM:SS"
 * @param onProgress Optional callback for progress updates
 * @returns Promise resolving to an array of extracted frames with timestamps
 */
export const extractFramesFromVideoUrl = async (
  videoUrl: string,
  timestamps: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<Array<{ timestamp: string, frame: Blob }>> => {
  // Create and load the video element
  console.log(`Starting frame extraction for ${timestamps.length} timestamps`);
  const video = await createVideoElement(videoUrl);
  
  // Convert timestamps to seconds
  const timestampsInSeconds = timestamps.map(t => ({
    original: t,
    seconds: timestampToSeconds(t)
  }));
  
  // Sort timestamps to process them in order
  timestampsInSeconds.sort((a, b) => a.seconds - b.seconds);
  
  const results: Array<{ timestamp: string, frame: Blob }> = [];
  let completed = 0;
  
  // Process each timestamp
  for (const { original, seconds } of timestampsInSeconds) {
    try {
      console.log(`Extracting frame at timestamp ${original} (${seconds}s)`);
      const frame = await extractFrameFromVideo(video, seconds);
      
      results.push({
        timestamp: original,
        frame
      });
      
      completed++;
      if (onProgress) {
        onProgress(completed, timestampsInSeconds.length);
      }
    } catch (error) {
      console.error(`Failed to extract frame at ${original}:`, error);
      // Continue with other timestamps even if one fails
    }
  }
  
  return results;
};
