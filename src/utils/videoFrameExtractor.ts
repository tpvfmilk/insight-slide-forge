
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
    console.log("Starting frame extraction from video:", videoUrl);
    
    // Create video element
    const video = document.createElement("video");
    
    // Enable CORS explicitly (important for cross-origin video sources)
    video.crossOrigin = "anonymous";
    video.muted = true; // Mute to avoid audio playing
    video.playsInline = true; // Better mobile support
    
    // Array to store extracted frames
    const frames: Array<{ timestamp: string; frame: Blob }> = [];
    
    // Number of frames processed
    let framesProcessed = 0;
    
    // Create a canvas element for frame extraction
    const canvas = document.createElement("canvas");
    let ctx: CanvasRenderingContext2D | null = null;
    
    // Add more detailed event listeners for debugging
    video.onloadstart = () => console.log("Video load started");
    video.onwaiting = () => console.log("Video is waiting for data");
    video.onstalled = () => console.log("Video download stalled");
    video.onsuspend = () => console.log("Video download suspended");
    video.onabort = () => console.log("Video loading aborted");
    
    // Critical event: Wait until the video can actually play
    video.oncanplay = function() {
      console.log(`Video is ready to play. Dimensions: ${video.videoWidth}x${video.videoHeight}, Network state: ${video.networkState}, Ready state: ${video.readyState}`);
      
      // If video dimensions are 0, we have an issue
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        reject(new Error("Video dimensions could not be determined. Check CORS settings and ensure the video is properly loaded."));
        return;
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx = canvas.getContext("2d", { alpha: false }); // Disable alpha for better performance
      
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      // Draw a test frame to make sure canvas is working
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const testData = ctx.getImageData(0, 0, 10, 10);
        console.log("Canvas test successful, pixel data available:", testData.data.some(val => val !== 0));
      } catch (e) {
        console.error("Canvas error on test draw:", e);
        reject(new Error(`Canvas drawing failed: ${e.message}. Possible CORS issue. Try using a different video source or ensure proper CORS headers are set.`));
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
      
      // Process timestamps sequentially with pause between each to ensure stability
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
      
      // Ensure playback is paused during seeking for accurate frame captures
      video.pause();
      
      // Set current time and wait for seeking to complete
      video.currentTime = seconds;
      
      // Handle the 'seeked' event
      video.onseeked = function() {
        console.log(`Seeked to ${video.currentTime.toFixed(2)}s for timestamp ${timestamp}`);
        
        if (ctx) {
          try {
            // Draw the current frame on the canvas
            ctx.fillStyle = 'rgb(0, 0, 0)'; // Clear with black background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Check if the frame has actual content (not just black)
            const pixelData = ctx.getImageData(
              canvas.width / 4, canvas.height / 4, 
              canvas.width / 2, canvas.height / 2
            );
            
            // Check if image data actually contains non-black pixels
            const hasContent = Array.from(pixelData.data).some(
              (value, index) => index % 4 !== 3 && value > 10
            );
            
            if (!hasContent) {
              console.warn(`Frame at ${timestamp} appears to be empty/black - this may be due to CORS restrictions or a dark video frame`);
            }
            
            // Add timestamp as text overlay for debugging (can be commented out in production)
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(10, 10, 300, 30);
            ctx.fillStyle = "white";
            ctx.font = "16px Arial";
            ctx.fillText(`Timestamp: ${timestamp} (${seconds.toFixed(2)}s)`, 15, 30);
            
            // Convert canvas to blob
            canvas.toBlob((blob) => {
              if (blob) {
                console.log(`Created blob for timestamp ${timestamp}, size: ${blob.size} bytes`);
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
              
              // Small delay before processing next frame to ensure stability
              setTimeout(() => {
                processNextTimestamp(validTimestamps, index + 1);
              }, 100);
            }, "image/jpeg", 0.92); // Use JPEG format with 92% quality
          } catch (e) {
            console.error(`Error capturing frame at ${timestamp}:`, e);
            
            // Continue with next frame despite error
            framesProcessed++;
            if (progressCallback) {
              progressCallback(framesProcessed, validTimestamps.length);
            }
            
            processNextTimestamp(validTimestamps, index + 1);
          }
        } else {
          console.error("Canvas context is null");
          processNextTimestamp(validTimestamps, index + 1);
        }
      };
      
      // Set a timeout in case seeking gets stuck
      const seekTimeout = setTimeout(() => {
        console.warn(`Seek timeout for timestamp ${timestamp}, skipping...`);
        video.onseeked = null; // Clear the event handler
        
        // Move to next timestamp
        framesProcessed++;
        if (progressCallback) {
          progressCallback(framesProcessed, validTimestamps.length);
        }
        
        processNextTimestamp(validTimestamps, index + 1);
      }, 5000); // 5 second timeout for seeking
      
      // Clear timeout when seeked event fires
      const originalOnSeeked = video.onseeked;
      video.onseeked = function() {
        clearTimeout(seekTimeout);
        if (originalOnSeeked) {
          originalOnSeeked.call(video);
        }
      };
    }
    
    // Start loading the video with cache busting
    console.log(`Loading video from URL: ${videoUrl}`);
    const cacheBuster = videoUrl.includes('?') ? `&_cb=${Date.now()}` : `?_cb=${Date.now()}`;
    video.src = videoUrl + cacheBuster;
    video.preload = "auto";
    video.load(); // Explicitly load the video
    
    // Try to play (even muted) to ensure proper loading on some browsers
    video.play().catch(err => {
      console.warn("Video play failed (expected for extraction):", err);
      // Continue anyway as we're just using play to ensure proper loading
    });
  });
}
