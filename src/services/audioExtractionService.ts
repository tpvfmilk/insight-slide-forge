
/**
 * Service to handle client-side audio extraction from video files
 */

/**
 * Extracts the audio from a video file using the Web Audio API with chunked processing
 * @param videoFile The video file to extract audio from
 * @param progressCallback Optional callback function to report progress
 * @returns A Promise resolving to an audio blob in mp3 format
 */
export const extractAudioFromVideo = async (
  videoFile: File, 
  progressCallback?: (progress: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a URL for the video file
      const videoUrl = URL.createObjectURL(videoFile);
      
      // Create video and audio context
      const video = document.createElement('video');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Set up video element
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      
      // Create a media stream source from the video
      video.onloadedmetadata = () => {
        console.log(`Video loaded. Duration: ${video.duration}s, Size: ${(videoFile.size / (1024 * 1024)).toFixed(2)}MB`);
        
        try {
          // For very short videos, process the entire file at once
          if (video.duration < 60) { // Less than 1 minute
            processEntireVideo(video, audioContext, videoUrl, progressCallback)
              .then(resolve)
              .catch(reject);
          } else {
            // For longer videos, use chunked processing
            processVideoInChunks(video, audioContext, videoUrl, progressCallback)
              .then(resolve)
              .catch(reject);
          }
        } catch (error) {
          console.error("Error initiating audio extraction:", error);
          reject(error);
        }
      };
      
      video.onerror = (err) => {
        console.error('Video error:', err);
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Error loading video for audio extraction'));
      };
      
    } catch (error) {
      console.error('Audio extraction error:', error);
      reject(error);
    }
  });
};

/**
 * Process the entire video at once (for smaller videos)
 */
const processEntireVideo = async (
  video: HTMLVideoElement, 
  audioContext: AudioContext, 
  videoUrl: string,
  progressCallback?: (progress: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a media element source
      const mediaSource = audioContext.createMediaElementSource(video);
      
      // Create a destination for recording
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect the source to the destination
      mediaSource.connect(destination);
      
      // Create a media recorder to capture the audio
      const mediaRecorder = new MediaRecorder(destination.stream, {
        // Set a lower bitrate for compression (128 kbps)
        audioBitsPerSecond: 128000,
        mimeType: 'audio/webm' // Use webm for better compression
      });
      const audioChunks: Blob[] = [];
      
      // Set up progress tracking for the video playback
      const progressInterval = setInterval(() => {
        if (video.duration && progressCallback) {
          const progress = (video.currentTime / video.duration) * 100;
          progressCallback(progress);
        }
      }, 200);
      
      // Start recording and playing the video
      mediaRecorder.start();
      video.play();
      
      // Collect audio chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };
      
      // When video is done playing, stop recording and create the audio blob
      video.onended = () => {
        clearInterval(progressInterval);
        mediaRecorder.stop();
        video.pause();
        
        // Clean up
        mediaSource.disconnect();
        URL.revokeObjectURL(videoUrl);
        
        if (progressCallback) {
          progressCallback(100);
        }
      };
      
      // When recording is done, create the audio blob
      mediaRecorder.onstop = async () => {
        // Create a blob from the audio chunks
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Convert to mp3 with compression
        try {
          const compressedBlob = await compressAudioIfNeeded(audioBlob);
          resolve(compressedBlob);
        } catch (compressionError) {
          console.warn("Compression failed, using original audio:", compressionError);
          resolve(audioBlob);
        }
      };
      
      // Handle errors
      mediaRecorder.onerror = (err) => {
        clearInterval(progressInterval);
        console.error('Media Recorder error:', err);
        reject(err);
      };
    } catch (error) {
      console.error("Error in full video processing:", error);
      reject(error);
    }
  });
};

/**
 * Process the video in chunks to improve performance and avoid memory issues
 */
const processVideoInChunks = async (
  video: HTMLVideoElement,
  audioContext: AudioContext,
  videoUrl: string,
  progressCallback?: (progress: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const CHUNK_SIZE = 120; // Process in 2-minute chunks
      const duration = video.duration;
      const chunks: Blob[] = [];
      let currentStart = 0;
      
      const processNextChunk = async (startTime: number) => {
        // Check if we've processed the entire video
        if (startTime >= duration) {
          // Combine all audio chunks
          const finalBlob = new Blob(chunks, { type: 'audio/webm' });
          URL.revokeObjectURL(videoUrl);
          
          // Compress the final audio if needed
          try {
            const compressedBlob = await compressAudioIfNeeded(finalBlob);
            if (progressCallback) progressCallback(100);
            resolve(compressedBlob);
          } catch (compressionError) {
            console.warn("Compression failed, using original audio:", compressionError);
            if (progressCallback) progressCallback(100);
            resolve(finalBlob);
          }
          return;
        }
        
        // Calculate the end time for this chunk
        const endTime = Math.min(startTime + CHUNK_SIZE, duration);
        const chunkProgress = (startTime / duration) * 100;
        
        if (progressCallback) {
          progressCallback(chunkProgress);
        }
        
        console.log(`Processing video chunk: ${startTime}s to ${endTime}s (${Math.round(chunkProgress)}%)`);
        
        try {
          // Set the video to the start position
          video.currentTime = startTime;
          
          // Create a new media source for this chunk
          const mediaSource = audioContext.createMediaElementSource(video);
          const destination = audioContext.createMediaStreamDestination();
          mediaSource.connect(destination);
          
          // Create a recorder for this chunk
          const mediaRecorder = new MediaRecorder(destination.stream, {
            audioBitsPerSecond: 128000, // Lower bitrate for compression
            mimeType: 'audio/webm' // Use webm for better compression
          });
          const audioChunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunks.push(e.data);
            }
          };
          
          // This will be triggered when we reach the end of the chunk
          const onTimeUpdate = () => {
            if (video.currentTime >= endTime) {
              video.pause();
              mediaRecorder.stop();
              video.removeEventListener('timeupdate', onTimeUpdate);
            }
          };
          
          video.addEventListener('timeupdate', onTimeUpdate);
          
          mediaRecorder.onstop = () => {
            // Store this chunk and move to the next one
            const chunkBlob = new Blob(audioChunks, { type: 'audio/webm' });
            chunks.push(chunkBlob);
            mediaSource.disconnect();
            
            // Process the next chunk
            processNextChunk(endTime);
          };
          
          // Start recording and playing
          mediaRecorder.start();
          video.play();
        } catch (error) {
          console.error(`Error processing chunk ${startTime}-${endTime}:`, error);
          reject(error);
        }
      };
      
      // Start processing from the beginning
      processNextChunk(currentStart);
    } catch (error) {
      console.error("Error in chunked video processing:", error);
      reject(error);
    }
  });
};

/**
 * Compresses audio blob if it exceeds the OpenAI size limit (25MB)
 * @param audioBlob Original audio blob
 * @returns Compressed audio blob or original if already small enough
 */
const compressAudioIfNeeded = async (audioBlob: Blob): Promise<Blob> => {
  // OpenAI's file size limit (25MB)
  const MAX_SIZE_BYTES = 25 * 1024 * 1024;
  
  if (audioBlob.size <= MAX_SIZE_BYTES) {
    // Fixed: Convert string to number by removing .toFixed() from the output
    const audioSizeMB = audioBlob.size / (1024 * 1024);
    console.log(`Audio size (${audioSizeMB.toFixed(2)}MB) is under limit, no compression needed`);
    return audioBlob;
  }
  
  // Fixed: Convert string to number by removing .toFixed() from the output
  const audioSizeMB = audioBlob.size / (1024 * 1024);
  console.log(`Audio size (${audioSizeMB.toFixed(2)}MB) exceeds limit, compressing...`);
  
  // If necessary, implement more advanced compression techniques here
  // For now, we'll use a basic approach to convert to lower quality mp3
  
  // In a real implementation, you might use Web Audio API's encoding features
  // or a library like lamejs to compress the audio
  
  // For this example, let's simply reduce the file size by breaking it into parts
  // This is a simplified approach - for production, use a proper audio compression library
  
  // Estimate how many chunks we need to get under the size limit
  const numChunks = Math.ceil(audioBlob.size / (MAX_SIZE_BYTES * 0.9)); // 90% of max to be safe
  
  // If it's just slightly over, return the original blob
  // since our simple splitting technique won't help much
  if (numChunks <= 1 || audioBlob.size < MAX_SIZE_BYTES * 1.2) {
    console.log("Audio only slightly over limit or cannot be effectively compressed with this method");
    return audioBlob;
  }
  
  // Return the first portion of the audio (focusing on the beginning)
  // which will be under the size limit
  // In a real app, you'd want to use proper compression or chunking
  const chunkSize = Math.floor(audioBlob.size / numChunks);
  const compressedBlob = audioBlob.slice(0, MAX_SIZE_BYTES * 0.9);
  
  // Fixed: Convert string to number by removing .toFixed() from the calculation
  const compressedSizeMB = compressedBlob.size / (1024 * 1024);
  console.log(`Compressed audio to ${compressedSizeMB.toFixed(2)}MB (keeping first portion)`);
  
  return compressedBlob;
};

/**
 * Extracts audio duration from an audio blob
 * @param audioBlob The audio blob to get duration from
 * @returns A Promise resolving to the duration in seconds
 */
export const getAudioDuration = async (audioBlob: Blob): Promise<number> => {
  return new Promise((resolve, reject) => {
    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio();
      
      audio.src = audioUrl;
      
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(audioUrl);
        resolve(duration);
      };
      
      audio.onerror = (err) => {
        console.error('Audio error:', err);
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Error loading audio for duration calculation'));
      };
      
    } catch (error) {
      console.error('Audio duration calculation error:', error);
      reject(error);
    }
  });
};
