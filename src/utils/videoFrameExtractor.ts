/**
 * Extract frames from a video at specific timestamps
 */

/**
 * Extract frames from a video at specific timestamps
 * @param videoUrl URL of the video file
 * @param timestamps Array of timestamps in format "HH:MM:SS" to extract frames at
 * @param onProgress Optional progress callback (completed, total)
 * @param videoDuration Optional video duration in seconds (for validation)
 * @returns Array of extracted frames with their timestamps
 */
export const extractFramesFromVideoUrl = async (
  videoUrl: string,
  timestamps: string[],
  onProgress?: (completed: number, total: number) => void,
  videoDuration?: number
): Promise<Array<{ timestamp: string, frame: Blob }>> => {
  try {
    if (!timestamps || timestamps.length === 0) {
      throw new Error('No timestamps provided for frame extraction');
    }
    
    console.log(`Extracting ${timestamps.length} frames from video`);
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
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
        reject(new Error('Video load timeout after 30 seconds'));
        // Clean up the video element
        video.src = '';
        video.load();
      }, 30000); // 30 seconds timeout
      
      const extractedFrames: Array<{ timestamp: string, frame: Blob }> = [];
      let completedExtractions = 0;
      
      // Convert timestamps to seconds for easier comparison
      const timestampsInSeconds = timestamps.map(timestamp => {
        const parts = timestamp.split(':').map(part => parseInt(part, 10));
        if (parts.length === 3) {
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          return parts[0] * 60 + parts[1];
        }
        return 0;
      });
      
      // Function to extract a frame at the current playback position
      const extractCurrentFrame = (): Blob | null => {
        try {
          // Create a canvas at the current video dimensions
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw the current frame to the canvas
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Could not get 2D context from canvas');
            return null;
          }
          
          // Draw the video frame on the canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to blob
          const dataURL = canvas.toDataURL('image/jpeg', 0.92); // Use 92% quality JPEG
          const base64 = dataURL.split(',')[1];
          const byteCharacters = atob(base64);
          const byteArrays = [];
          
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
          }
          
          return new Blob(byteArrays, { type: 'image/jpeg' });
        } catch (error) {
          console.error('Error extracting frame:', error);
          return null;
        }
      };
      
      // Process each timestamp in sequence
      const processNextTimestamp = (index: number) => {
        if (index >= timestamps.length) {
          // All timestamps processed
          clearTimeout(loadTimeout);
          onProgress?.(timestamps.length, timestamps.length);
          
          // Clean up and resolve
          video.src = '';
          video.load();
          resolve(extractedFrames);
          return;
        }
        
        const currentTimestamp = timestamps[index];
        const seekTime = timestampsInSeconds[index];
        
        // Skip invalid timestamps (beyond video duration)
        if (videoDuration && seekTime > videoDuration) {
          console.warn(`Skipping timestamp ${currentTimestamp} (${seekTime}s) as it exceeds video duration (${videoDuration}s)`);
          completedExtractions++;
          onProgress?.(completedExtractions, timestamps.length);
          processNextTimestamp(index + 1);
          return;
        }
        
        // Seek to the current timestamp
        video.currentTime = seekTime;
      };
      
      // When the video can seek, set up the 'seeked' event to extract frames
      video.addEventListener('canplay', () => {
        clearTimeout(loadTimeout);
        
        // When seeking is complete, extract the frame
        video.addEventListener('seeked', () => {
          console.log(`Extracting frame at timestamp ${timestamps[completedExtractions]} (${Math.round(video.currentTime)}s)`);
          
          const currentTimestamp = timestamps[completedExtractions];
          const frame = extractCurrentFrame();
          
          if (frame) {
            extractedFrames.push({
              timestamp: currentTimestamp,
              frame
            });
          } else {
            console.error(`Failed to extract frame at timestamp ${currentTimestamp}`);
          }
          
          completedExtractions++;
          onProgress?.(completedExtractions, timestamps.length);
          
          // Process the next timestamp
          processNextTimestamp(completedExtractions);
        });
        
        // Get actual video duration for validation
        if (!videoDuration) {
          videoDuration = Math.round(video.duration);
          console.log(`Video duration detected: ${videoDuration} seconds`);
        }
        
        // Start processing the first timestamp
        processNextTimestamp(0);
      });
      
      // Handle errors
      video.addEventListener('error', (e) => {
        clearTimeout(loadTimeout);
        console.error('Video error:', video.error);
        reject(new Error(`Video error: ${video.error ? video.error.message : 'unknown error'}`));
        
        // Clean up the video element
        video.src = '';
        video.load();
      });
      
      // Start loading the video
      video.src = corsUrl.toString();
      video.load();
    });
  } catch (error) {
    console.error('Error in extractFramesFromVideoUrl:', error);
    throw error;
  }
};

/**
 * Convert a timestamp in format "HH:MM:SS" to seconds
 * @param timestamp Timestamp string in format "HH:MM:SS" or "MM:SS"
 * @returns Number of seconds
 */
const timestampToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(':').map(part => parseInt(part, 10));
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  
  return 0;
};
