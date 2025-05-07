
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
 * Extracts a frame from a video at a specific timestamp
 * @param videoElement HTML Video element to extract from
 * @param timestamp Timestamp in seconds
 * @returns Promise resolving to a Blob of the extracted frame
 */
export const extractFrameFromVideo = (
  videoElement: HTMLVideoElement,
  timestamp: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Set the current time of the video to the requested timestamp
    videoElement.currentTime = timestamp;
    
    const seekTimeout = setTimeout(() => {
      reject(new Error(`Seek timeout at timestamp ${timestamp}s`));
    }, 10000); // 10 second timeout for seeking
    
    // Wait for the video to seek to the specified timestamp
    videoElement.onseeked = () => {
      clearTimeout(seekTimeout);
      
      try {
        // Create a canvas element with the same dimensions as the video
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        // Draw the current frame to the canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Try to draw the frame to canvas
        try {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        } catch (drawError) {
          reject(new Error(`CORS error or failed to draw video frame: ${drawError.message}`));
          return;
        }
        
        // Convert the canvas to a blob
        canvas.toBlob((blob) => {
          if (blob) {
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
    
    // Set up event handlers
    video.onloadedmetadata = () => {
      resolve(video);
    };
    
    video.onerror = () => {
      reject(new Error(`Failed to load video: ${video.error?.message || 'Unknown error'}`));
    };
    
    // Set a timeout in case the video never loads
    const timeout = setTimeout(() => {
      reject(new Error('Video loading timeout'));
    }, 30000); // 30 second timeout
    
    // Add the loaded event handler to clear the timeout
    video.addEventListener('loadeddata', () => {
      clearTimeout(timeout);
    });
    
    // Set the source and start loading
    video.src = videoUrl;
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
