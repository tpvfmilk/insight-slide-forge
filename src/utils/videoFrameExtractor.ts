
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
    
    // Wait for the video to seek to the specified timestamp
    videoElement.onseeked = () => {
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
        
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
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
      reject(new Error(`Video error at timestamp ${timestamp}`));
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
      // Once metadata is loaded, seek to beginning to ensure it's ready
      video.currentTime = 0;
    };
    
    video.oncanplay = () => {
      resolve(video);
    };
    
    video.onerror = () => {
      reject(new Error(`Failed to load video from ${videoUrl}`));
    };
    
    // Start loading the video
    video.src = videoUrl;
  });
};

/**
 * Generates a public URL for a video file in Supabase storage
 * @param path Storage path to the video file
 * @returns Public URL for the video
 */
export const getVideoPublicUrl = (path: string): string => {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data } = supabase.storage.from('video_uploads').getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Extract multiple frames from a video at specified timestamps
 * @param videoUrl URL of the video to process
 * @param timestamps Array of timestamps (HH:MM:SS format)
 * @param onProgress Optional callback for reporting progress
 * @returns Array of objects containing timestamp and frame blob
 */
export const extractFramesFromVideoUrl = async (
  videoUrl: string,
  timestamps: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<Array<{ timestamp: string, frame: Blob }>> => {
  try {
    // Create and load the video element
    const video = await createVideoElement(videoUrl);
    
    const results: Array<{ timestamp: string, frame: Blob }> = [];
    
    // Process each timestamp
    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const seconds = timestampToSeconds(timestamp);
      
      try {
        const frameBlob = await extractFrameFromVideo(video, seconds);
        results.push({ timestamp, frame: frameBlob });
      } catch (error) {
        console.error(`Failed to extract frame at ${timestamp}:`, error);
      }
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, timestamps.length);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error extracting frames:', error);
    throw error;
  }
};
