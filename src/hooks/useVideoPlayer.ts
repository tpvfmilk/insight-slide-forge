
import { useState, useRef, useEffect, useCallback } from 'react';
import { getVideoSignedUrl, updateProjectDuration } from '@/utils/videoUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

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
  
  // Use refs to track state without triggering re-renders
  const stateRef = useRef({
    isPlaying: false,
    currentTime: 0,
    isSeeking: false,
    seekingValue: 0,
    isVideoLoaded: false,
    playAttempted: false
  });

  // Sync state with refs to avoid closure issues
  useEffect(() => {
    stateRef.current.isPlaying = isPlaying;
    stateRef.current.currentTime = currentTime;
    stateRef.current.isSeeking = isSeeking;
    stateRef.current.seekingValue = seekingValue;
    stateRef.current.isVideoLoaded = isVideoLoaded;
  }, [isPlaying, currentTime, isSeeking, seekingValue, isVideoLoaded]);

  // Load the video URL
  useEffect(() => {
    const loadVideo = async () => {
      if (!videoPath) {
        console.log("No video path provided");
        setVideoError("No video file path provided.");
        setIsLoadingVideo(false);
        return;
      }

      try {
        setIsLoadingVideo(true);
        setVideoError(null);
        console.log("[VideoPlayer] Loading video path:", videoPath);
        
        // Get signed URL for the video
        const signedUrl = await getVideoSignedUrl(supabase, videoPath);
        console.log("[VideoPlayer] Video URL obtained:", signedUrl ? "Success" : "Failed");
        
        if (signedUrl) {
          setVideoUrl(signedUrl);
          console.log("[VideoPlayer] Video URL set successfully");
          
          // Notify parent component of the URL update
          if (onVideoUrlUpdate) {
            console.log("[VideoPlayer] Notifying parent of URL update");
            onVideoUrlUpdate(signedUrl);
          }
        } else {
          throw new Error("Failed to get video URL");
        }
      } catch (error) {
        console.error("[VideoPlayer] Error loading video:", error);
        setVideoError(`Error loading video: ${error instanceof Error ? error.message : String(error)}`);
        toast({
          title: "Video Error",
          description: "Failed to load video. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoadingVideo(false);
      }
    };

    loadVideo();
  }, [videoPath, onVideoUrlUpdate]);

  // Update video time using requestAnimationFrame for smoother updates
  const updateTime = useCallback(() => {
    if (videoRef.current && !stateRef.current.isSeeking) {
      const newTime = videoRef.current.currentTime;
      
      // Only update state if the time has changed significantly (prevent unnecessary re-renders)
      if (Math.abs(stateRef.current.currentTime - newTime) >= 0.1) {
        console.log(`[VideoPlayer] Time updated: ${newTime.toFixed(2)}s`);
        setCurrentTime(newTime);
        setSeekingValue(newTime);
        stateRef.current.currentTime = newTime;
        
        // Call the onTimeUpdate callback
        if (onTimeUpdate) {
          onTimeUpdate(newTime);
        }
      }
    }
    
    // Continue animation loop only if playing
    if (stateRef.current.isPlaying) {
      requestAnimationFrame(updateTime);
    }
  }, [onTimeUpdate]);

  // Setup animation frame for time updates when playing state changes
  useEffect(() => {
    if (isPlaying) {
      console.log("[VideoPlayer] Starting playback time updates");
      requestAnimationFrame(updateTime);
    }
  }, [isPlaying, updateTime]);

  // Add event listeners for video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handlePlay = () => {
      console.log("[VideoPlayer] Play event fired");
      setIsPlaying(true);
      stateRef.current.isPlaying = true;
    };
    
    const handlePause = () => {
      console.log("[VideoPlayer] Pause event fired");
      setIsPlaying(false);
      stateRef.current.isPlaying = false;
    };
    
    const handleEnded = () => {
      console.log("[VideoPlayer] Video ended");
      setIsPlaying(false);
      stateRef.current.isPlaying = false;
    };
    
    const handleError = (e: Event) => {
      console.error("[VideoPlayer] Video error event:", e);
      handleVideoError(e);
    };
    
    // Listen for native video events
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, []);

  // Handle video loaded
  const handleVideoLoaded = useCallback(() => {
    if (!videoRef.current) return;
    
    const videoDuration = videoRef.current.duration;
    console.log("[VideoPlayer] Video loaded with duration:", videoDuration);
    
    if (!isNaN(videoDuration) && videoDuration > 0) {
      setDuration(videoDuration);
      setIsVideoLoaded(true);
      stateRef.current.isVideoLoaded = true;
      
      // Update seekingValue to match current time
      setSeekingValue(videoRef.current.currentTime);
      stateRef.current.seekingValue = videoRef.current.currentTime;
      
      // Call onVideoLoaded callback
      if (onVideoLoaded) {
        console.log("[VideoPlayer] Notifying parent of video load with duration:", videoDuration);
        onVideoLoaded(videoDuration);
      }
      
      // Update project metadata with video duration
      updateProjectDuration(supabase, projectId, videoDuration)
        .then(() => console.log("[VideoPlayer] Updated project duration metadata"))
        .catch(err => console.error("[VideoPlayer] Failed to update project duration:", err));
        
      // If there was a play attempt during loading, try to play now
      if (stateRef.current.playAttempted) {
        console.log("[VideoPlayer] Auto-playing after load due to previous attempt");
        videoRef.current.play()
          .then(() => {
            console.log("[VideoPlayer] Auto-play successful");
            setIsPlaying(true);
            stateRef.current.isPlaying = true;
          })
          .catch(error => {
            console.error("[VideoPlayer] Auto-play failed:", error);
            setIsPlaying(false);
            stateRef.current.isPlaying = false;
          });
        stateRef.current.playAttempted = false;
      }
    } else {
      console.warn("[VideoPlayer] Invalid video duration:", videoDuration);
    }
  }, [onVideoLoaded, projectId]);

  // Handle video error
  const handleVideoError = useCallback((e: Event) => {
    console.error("[VideoPlayer] Video error event:", e);
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
    stateRef.current.isVideoLoaded = false;
    console.error("[VideoPlayer] Video error:", errorMessage);
    
    toast({
      title: "Video Playback Error",
      description: errorMessage,
      variant: "destructive"
    });
  }, []);

  // Toggle play/pause with improved error handling
  const togglePlayPause = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) {
      console.error("[VideoPlayer] No video element reference");
      return;
    }
    
    console.log("[VideoPlayer] Toggle play/pause. Current state:", isPlaying ? "playing" : "paused");
    
    if (isPlaying) {
      // Pause the video
      console.log("[VideoPlayer] Attempting to pause");
      videoEl.pause();
      // Note: state will be updated via the pause event listener
    } else {
      // Try to play the video
      console.log("[VideoPlayer] Attempting to play");
      
      // If seeking is active, first apply the seek
      if (stateRef.current.isSeeking) {
        console.log("[VideoPlayer] Applying seek before play:", stateRef.current.seekingValue);
        videoEl.currentTime = stateRef.current.seekingValue;
        stateRef.current.isSeeking = false;
        setIsSeeking(false);
      }
      
      // Attempt to play with proper error handling
      const playPromise = videoEl.play();
      
      // Handle the play promise
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("[VideoPlayer] Play successful");
            // State update will happen via play event listener
          })
          .catch(error => {
            console.error("[VideoPlayer] Play failed:", error);
            // Since play failed, make sure UI reflects paused state
            setIsPlaying(false);
            stateRef.current.isPlaying = false;
            
            if (!stateRef.current.isVideoLoaded) {
              console.log("[VideoPlayer] Video not fully loaded, marking play attempted");
              stateRef.current.playAttempted = true;
            }
            
            toast({
              title: "Playback Error",
              description: "Could not play the video. Please try again.",
              variant: "destructive"
            });
          });
      } else {
        console.log("[VideoPlayer] Play call did not return a promise");
      }
    }
  }, [isPlaying]);

  // Seek back 5 seconds
  const seekBack = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) {
      console.log("[VideoPlayer] Can't seek back - video not loaded");
      return;
    }
    
    const newTime = Math.max(0, videoRef.current.currentTime - 5);
    console.log(`[VideoPlayer] Seeking back to ${newTime.toFixed(2)}s`);
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    
    // Update state refs
    stateRef.current.isSeeking = false;
    stateRef.current.currentTime = newTime;
    stateRef.current.seekingValue = newTime;
    
    // Notify parent of time update
    if (onTimeUpdate) {
      onTimeUpdate(newTime);
    }
  }, [isVideoLoaded, onTimeUpdate]);

  // Seek forward 5 seconds
  const seekForward = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) {
      console.log("[VideoPlayer] Can't seek forward - video not loaded");
      return;
    }
    
    const newTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
    console.log(`[VideoPlayer] Seeking forward to ${newTime.toFixed(2)}s`);
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    
    // Update state refs
    stateRef.current.isSeeking = false;
    stateRef.current.currentTime = newTime;
    stateRef.current.seekingValue = newTime;
    
    // Notify parent of time update
    if (onTimeUpdate) {
      onTimeUpdate(newTime);
    }
  }, [isVideoLoaded, onTimeUpdate]);

  // Seek handling
  const handleSeekStart = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) {
      console.log("[VideoPlayer] Can't start seeking - video not loaded");
      return;
    }
    
    console.log("[VideoPlayer] Seek start");
    
    // Set seeking flag
    setIsSeeking(true);
    stateRef.current.isSeeking = true;
    
    // Store playing state before pausing
    const wasPlaying = isPlaying;
    
    // Pause video while seeking
    if (wasPlaying && videoRef.current) {
      console.log("[VideoPlayer] Pausing for seek");
      videoRef.current.pause();
      // State will update via event listener
    }
  }, [isPlaying, isVideoLoaded]);

  const handleSeekChange = useCallback((values: number[]) => {
    if (!isVideoLoaded) {
      console.log("[VideoPlayer] Can't change seek - video not loaded");
      return;
    }
    
    // Update the seeking value for the UI
    const newValue = values[0];
    console.log(`[VideoPlayer] Seek change to ${newValue.toFixed(2)}s`);
    
    setSeekingValue(newValue);
    stateRef.current.seekingValue = newValue;
  }, [isVideoLoaded]);

  const handleSeekEnd = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) {
      console.log("[VideoPlayer] Can't end seeking - video not loaded");
      return;
    }
    
    // Get the target time from state
    const targetTime = stateRef.current.seekingValue;
    console.log(`[VideoPlayer] Seek end, applying time: ${targetTime.toFixed(2)}s`);
    
    try {
      // Apply the seek
      videoRef.current.currentTime = targetTime;
      console.log(`[VideoPlayer] Seek applied to ${targetTime.toFixed(2)}s`);
      
      // Update state
      setCurrentTime(targetTime);
      stateRef.current.currentTime = targetTime;
      
      // Notify parent of time update
      if (onTimeUpdate) {
        onTimeUpdate(targetTime);
      }
      
      // Wait a short delay before clearing the seeking state
      // This helps prevent race conditions with other events
      setTimeout(() => {
        console.log("[VideoPlayer] Clearing seek state");
        setIsSeeking(false);
        stateRef.current.isSeeking = false;
        
        // If it was playing before seeking, resume playback
        if (stateRef.current.isPlaying) {
          console.log("[VideoPlayer] Resuming playback after seek");
          videoRef.current?.play()
            .catch(error => {
              console.error("[VideoPlayer] Error resuming playback after seek:", error);
              setIsPlaying(false);
              stateRef.current.isPlaying = false;
            });
        }
      }, 50);
    } catch (error) {
      console.error("[VideoPlayer] Error during seek end:", error);
      setIsSeeking(false);
      stateRef.current.isSeeking = false;
    }
  }, [isVideoLoaded, onTimeUpdate]);

  // Retry loading the video if there was an error
  const retryLoadVideo = useCallback(async () => {
    if (!videoPath) {
      console.log("[VideoPlayer] No video path to retry");
      return;
    }
    
    console.log("[VideoPlayer] Retrying video load");
    setVideoError(null);
    setIsLoadingVideo(true);
    
    try {
      // Get a fresh signed URL
      const signedUrl = await getVideoSignedUrl(supabase, videoPath);
      
      if (signedUrl) {
        console.log("[VideoPlayer] Got new signed URL for retry");
        setVideoUrl(signedUrl);
        
        // Notify parent component of the URL update
        if (onVideoUrlUpdate) {
          onVideoUrlUpdate(signedUrl);
        }
        
        // Reset video player state
        setIsVideoLoaded(false);
        stateRef.current.isVideoLoaded = false;
        setCurrentTime(0);
        stateRef.current.currentTime = 0;
        setSeekingValue(0);
        stateRef.current.seekingValue = 0;
        setIsPlaying(false);
        stateRef.current.isPlaying = false;
        setIsSeeking(false);
        stateRef.current.isSeeking = false;
      } else {
        throw new Error("Failed to get video URL");
      }
    } catch (error) {
      console.error("[VideoPlayer] Error retrying video load:", error);
      setVideoError(`Error loading video: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [videoPath, onVideoUrlUpdate]);

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
