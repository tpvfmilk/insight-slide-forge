
/**
 * Service to handle client-side audio extraction from video files
 */

/**
 * Extracts the audio from a video file using the Web Audio API
 * @param videoFile The video file to extract audio from
 * @returns A Promise resolving to an audio blob in mp3 format
 */
export const extractAudioFromVideo = async (videoFile: File): Promise<Blob> => {
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
        // Create a media element source
        const mediaSource = audioContext.createMediaElementSource(video);
        
        // Create a destination for recording
        const destination = audioContext.createMediaStreamDestination();
        
        // Connect the source to the destination
        mediaSource.connect(destination);
        
        // Create a media recorder to capture the audio
        const mediaRecorder = new MediaRecorder(destination.stream);
        const audioChunks: Blob[] = [];
        
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
          mediaRecorder.stop();
          video.pause();
          
          // Clean up
          mediaSource.disconnect();
          URL.revokeObjectURL(videoUrl);
        };
        
        // When recording is done, create the audio blob
        mediaRecorder.onstop = () => {
          // Create a blob from the audio chunks
          const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
          resolve(audioBlob);
        };
        
        // Handle errors
        mediaRecorder.onerror = (err) => {
          console.error('Media Recorder error:', err);
          reject(err);
        };
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
