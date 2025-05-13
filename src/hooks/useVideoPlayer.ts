
import { useState, useRef, useEffect, useCallback } from 'react';
import { getVideoSignedUrl, updateProjectDuration } from '@/utils/videoUtils';
import { supabase } from '@/integrations/supabase/client';

interface UseVideoPlayerProps {
  videoPath: string;
  projectId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onVideoLoaded?: (duration: number) => void;
  onVideoUrlUpdate?: (url: string) => void;
}

export const useVideoPlayer = ({
  videoPath,
  projectId,
  onTimeUpdate,
  onVideoLoaded,
  onVideoUrlUpdate
}: UseVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekingValue, setSeekingValue] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const timeUpdateRef = useRef({ currentTime: 0 });

  // Important - track seeking state with a ref so we don't get race conditions
  const seekingRef = useRef({
    isSeeking: false,
    targetTime: 0
  });

  // Load the video URL
  useEffect(() => {
    const loadVideo = async () => {
      if (!videoPath) {
        setVideoError("No video file path provided.");
        setIsLoadingVideo(false);
        return;
      }

      try {
        setIsLoadingVideo(true);
        setVideoError(null);
        console.log("Loading video path:", videoPath);
        
        // Get signed URL for the video
        const signedUrl = await getVideoSignedUrl(supabase, videoPath);
        console.log("Video URL obtained:", signedUrl ? "Success" : "Failed");
        
        if (signedUrl) {
          setVideoUrl(signedUrl);
          
          // Notify parent component of the URL update
          if (onVideoUrlUpdate) {
            onVideoUrlUpdate(signedUrl);
          }
        } else {
          throw new Error("Failed to get video URL");
        }
      } catch (error) {
        console.error("Error loading video:", error);
        setVideoError(`Error loading video: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoadingVideo(false);
      }
    };

    loadVideo();
  }, [videoPath, onVideoUrlUpdate]);

  // Update video time - use this as a stable reference to be called in interval
  const updateTime = useCallback(() => {
    if (videoRef.current && !seekingRef.current.isSeeking) {
      const newTime = videoRef.current.currentTime;
      
      // Only update state if the time has changed significantly (prevent unnecessary re-renders)
      if (Math.abs(timeUpdateRef.current.currentTime - newTime) >= 0.1) {
        setCurrentTime(newTime);
        setSeekingValue(newTime);
        timeUpdateRef.current.currentTime = newTime;
        
        // Call the onTimeUpdate callback
        if (onTimeUpdate) {
          onTimeUpdate(newTime);
        }
      }
    }
  }, [onTimeUpdate]);

  // Set up time update interval instead of relying on the timeupdate event
  // This makes the UI more responsive and prevents video.currentTime and our state from getting out of sync
  useEffect(() => {
    const interval = setInterval(updateTime, 100); // Update 10 times per second
    return () => clearInterval(interval);
  }, [updateTime]);

  // Handle video loaded
  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      console.log("Video loaded with duration:", videoDuration);
      
      if (!isNaN(videoDuration) && videoDuration > 0) {
        setDuration(videoDuration);
        setIsVideoLoaded(true);
        
        // Update seekingValue to match current time
        setSeekingValue(videoRef.current.currentTime);
        
        // Call onVideoLoaded callback
        if (onVideoLoaded) {
          onVideoLoaded(videoDuration);
        }
        
        // Update project metadata with video duration
        updateProjectDuration(supabase, projectId, videoDuration)
          .then(() => console.log("Updated project duration metadata"))
          .catch(err => console.error("Failed to update project duration:", err));
      } else {
        console.warn("Invalid video duration:", videoDuration);
      }
    }
  }, [onVideoLoaded, projectId]);

  // Handle video error
  const handleVideoError = useCallback((e: Event) => {
    console.error("Video error event:", e);
    const videoElement = e.target as HTMLVideoElement;
    let errorMessage = "Unknown video error";
    
    if (videoElement && videoElement.error) {
      switch (videoElement.error.code) {
        case 1:
          errorMessage = "Video loading aborted";
          break;
        case 2:
          errorMessage = "Network error while loading video";
          break;
        case 3:
          errorMessage = "Video decoding failed";
          break;
        case 4:
          errorMessage = "Video not supported";
          break;
        default:
          errorMessage = `Video error: ${videoElement.error.message}`;
      }
    }
    
    setVideoError(errorMessage);
    setIsLoadingVideo(false);
    setIsVideoLoaded(false);
    console.error("Video error:", errorMessage);
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // If seeking is active, first apply the seek before playing
      if (seekingRef.current.isSeeking) {
        videoRef.current.currentTime = seekingRef.current.targetTime;
        seekingRef.current.isSeeking = false;
      }
      
      videoRef.current.play()
        .catch(error => {
          console.error("Error playing video:", error);
          setVideoError(`Error playing video: ${error.message}`);
        });
    }
    
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Seek back 5 seconds
  const seekBack = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) return;
    
    const newTime = Math.max(0, videoRef.current.currentTime - 5);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    
    // If we were seeking, update the seeking state
    seekingRef.current.isSeeking = false;
    timeUpdateRef.current.currentTime = newTime;
    
    // Notify parent of time update
    if (onTimeUpdate) {
      onTimeUpdate(newTime);
    }
  }, [isVideoLoaded, onTimeUpdate]);

  // Seek forward 5 seconds
  const seekForward = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) return;
    
    const newTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    
    // If we were seeking, update the seeking state
    seekingRef.current.isSeeking = false;
    timeUpdateRef.current.currentTime = newTime;
    
    // Notify parent of time update
    if (onTimeUpdate) {
      onTimeUpdate(newTime);
    }
  }, [isVideoLoaded, onTimeUpdate]);

  // Seek to specific time
  const handleSeekStart = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) return;
    
    // Set seeking flag and pause video during seek
    setIsSeeking(true);
    seekingRef.current.isSeeking = true;
    
    if (isPlaying) {
      videoRef.current.pause();
    }
  }, [isPlaying, isVideoLoaded]);

  const handleSeekChange = useCallback((values: number[]) => {
    if (!isVideoLoaded) return;
    
    // Update the seeking value for the UI
    const newValue = values[0];
    setSeekingValue(newValue);
    
    // Store the target time in seekingRef
    seekingRef.current.targetTime = newValue;
  }, [isVideoLoaded]);

  const handleSeekEnd = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) return;
    
    // Apply the seek
    const targetTime = seekingRef.current.targetTime;
    videoRef.current.currentTime = targetTime;
    
    // Update state
    setCurrentTime(targetTime);
    timeUpdateRef.current.currentTime = targetTime;
    setIsSeeking(false);
    
    // Notify parent of time update
    if (onTimeUpdate) {
      onTimeUpdate(targetTime);
    }
    
    // Resume playback if it was playing before
    if (isPlaying) {
      videoRef.current.play()
        .catch(error => {
          console.error("Error resuming playback after seek:", error);
        });
    }
    
    // Clear seeking flag after a short delay to prevent race conditions
    setTimeout(() => {
      seekingRef.current.isSeeking = false;
    }, 50);
  }, [isPlaying, isVideoLoaded, onTimeUpdate]);

  // Retry loading the video if there was an error
  const retryLoadVideo = useCallback(async () => {
    if (!videoPath) return;
    
    setVideoError(null);
    setIsLoadingVideo(true);
    
    try {
      // Get a fresh signed URL
      const signedUrl = await getVideoSignedUrl(supabase, videoPath);
      
      if (signedUrl) {
        setVideoUrl(signedUrl);
        
        // Notify parent component of the URL update
        if (onVideoUrlUpdate) {
          onVideoUrlUpdate(signedUrl);
        }
        
        // Reset video player state
        setIsVideoLoaded(false);
        setCurrentTime(0);
        setSeekingValue(0);
        setIsPlaying(false);
      } else {
        throw new Error("Failed to get video URL");
      }
    } catch (error) {
      console.error("Error retrying video load:", error);
      setVideoError(`Error loading video: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [videoPath, onVideoUrlUpdate]);

  // Update play state when video ends
  useEffect(() => {
    const videoElement = videoRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    if (videoElement) {
      videoElement.addEventListener('ended', handleEnded);
      return () => {
        videoElement.removeEventListener('ended', handleEnded);
      };
    }
  }, []);

  // Return the hook's API
  return {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    seekingValue,
    videoUrl,
    videoError,
    isVideoLoaded,
    isLoadingVideo,
    isSeeking,
    togglePlayPause,
    seekBack,
    seekForward,
    handleSeekStart,
    handleSeekChange,
    handleSeekEnd,
    handleVideoLoaded,
    handleVideoError,
    retryLoadVideo
  };
};
