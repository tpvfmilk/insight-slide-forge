
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getVideoSignedUrl, updateProjectDuration } from "@/utils/videoUtils";

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
  // Core state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [durationUpdatedInDB, setDurationUpdatedInDB] = useState(false);
  
  // Seeking state
  const [seekingValue, setSeekingValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  
  // Important refs for controlling video behavior
  const videoRef = useRef<HTMLVideoElement>(null);
  const playRequestPending = useRef(false);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Log initialization
  useEffect(() => {
    console.log("useVideoPlayer initialized with:", { 
      projectId, 
      videoPath: videoPath || "No path provided",
      hasTimeUpdateCallback: !!onTimeUpdate,
      hasVideoLoadedCallback: !!onVideoLoaded,
      hasUrlUpdateCallback: !!onVideoUrlUpdate 
    });
  }, [projectId, videoPath, onTimeUpdate, onVideoLoaded, onVideoUrlUpdate]);
  
  // Function to load the video
  const loadVideo = useCallback(async () => {
    if (!videoPath) {
      console.error("Cannot load video: No video path provided");
      setVideoError("No video path provided");
      setIsLoadingVideo(false);
      return;
    }
    
    setIsLoadingVideo(true);
    setVideoError(null);
    console.log(`[Attempt ${loadAttempts + 1}] Starting video loading process for path:`, videoPath);
    
    try {
      // Get a fresh signed URL with longer expiry
      const signedUrl = await getVideoSignedUrl(supabase, videoPath, 7200);
      
      console.log("Got signed URL for video:", signedUrl.substring(0, 50) + "...");
      setVideoUrl(signedUrl);
      
      // Notify parent immediately of URL update
      if (onVideoUrlUpdate) {
        console.log("Notifying parent component of video URL update");
        onVideoUrlUpdate(signedUrl);
      }
    } catch (error) {
      console.error("Error getting fresh video URL:", error);
      setVideoError(`Failed to access video (attempt ${loadAttempts + 1}). The video might be unavailable or the format is not supported.`);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [videoPath, loadAttempts, projectId, onVideoUrlUpdate]);
  
  // Load video on mount or when videoPath/loadAttempts changes
  useEffect(() => {
    loadVideo();
  }, [videoPath, loadAttempts, loadVideo]);
  
  // Handle video duration and update project metadata
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = async () => {
      const videoDuration = video.duration;
      if (videoDuration && !isNaN(videoDuration) && isFinite(videoDuration)) {
        console.log(`Video metadata loaded with duration: ${videoDuration}`);
        setDuration(videoDuration);
        setSeekingValue(0); // Reset seeking value to the start
        
        if (onVideoLoaded) {
          onVideoLoaded(videoDuration);
        }
        
        // Update project with the accurate duration
        if (projectId && videoDuration && !durationUpdatedInDB) {
          try {
            await updateProjectDuration(supabase, projectId, videoDuration);
            console.log("Updated project with accurate video duration:", videoDuration);
            setDurationUpdatedInDB(true);
          } catch (error) {
            console.error("Error updating video duration in project:", error);
          }
        }
      } else {
        console.warn("Invalid video duration detected:", videoDuration);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [projectId, onVideoLoaded, durationUpdatedInDB]);
  
  // Update time display when video is playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const updateTime = () => {
      if (!isSeeking && video.currentTime !== undefined) {
        const newTime = video.currentTime;
        setCurrentTime(newTime);
        setSeekingValue(newTime);
        onTimeUpdate?.(newTime);
      }
    };
    
    video.addEventListener('timeupdate', updateTime);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
    };
  }, [isSeeking, onTimeUpdate]);
  
  // Update isPlaying state based on video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handlePlay = () => {
      console.log("Video play event triggered");
      setIsPlaying(true);
      playRequestPending.current = false;
    };
    
    const handlePause = () => {
      console.log("Video pause event triggered");
      setIsPlaying(false);
      playRequestPending.current = false;
    };
    
    const handleEnded = () => {
      console.log("Video ended event triggered");
      setIsPlaying(false);
      playRequestPending.current = false;
    };
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  // Toggle play/pause with improved reliability
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVideoLoaded) {
      console.warn("Cannot toggle play/pause: Video not loaded");
      return;
    }
    
    // Prevent multiple rapid play/pause requests
    if (playRequestPending.current) {
      console.log("Play/pause request already pending, ignoring");
      return;
    }
    
    playRequestPending.current = true;
    console.log(`Attempting to ${isPlaying ? 'pause' : 'play'} video`);
    
    if (isPlaying) {
      // Pause is synchronous and usually reliable
      video.pause();
      setIsPlaying(false);
      playRequestPending.current = false;
    } else {
      // Play is asynchronous and may fail
      video.play().then(() => {
        console.log("Play promise resolved successfully");
        setIsPlaying(true);
        playRequestPending.current = false;
      }).catch(error => {
        console.error("Error playing video:", error);
        setIsPlaying(false);
        playRequestPending.current = false;
        toast("Failed to play video. The video format might not be supported.");
      });
    }
  }, [isPlaying, isVideoLoaded]);
  
  // Seek back 5 seconds with improved handling
  const seekBack = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVideoLoaded) return;
    
    console.log("Seeking back 5 seconds");
    const newTime = Math.max(0, video.currentTime - 5);
    
    // Apply the new time to both the video and state
    video.currentTime = newTime;
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    onTimeUpdate?.(newTime);
  }, [isVideoLoaded, onTimeUpdate]);
  
  // Seek forward 5 seconds with improved handling
  const seekForward = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVideoLoaded) return;
    
    console.log("Seeking forward 5 seconds");
    const newTime = Math.min(video.duration || 0, video.currentTime + 5);
    
    // Apply the new time to both the video and state
    video.currentTime = newTime;
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    onTimeUpdate?.(newTime);
  }, [isVideoLoaded, onTimeUpdate]);
  
  // Completely reworked seeking implementation
  // 1. Start seeking - pause video and mark as seeking
  const handleSeekStart = useCallback(() => {
    console.log("Seek operation started");
    
    // If video was playing, pause it during seeking
    const video = videoRef.current;
    if (video && isPlaying) {
      video.pause();
    }
    
    // Set seeking state
    setIsSeeking(true);
    
    // Clear any pending seek timeouts
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  }, [isPlaying]);

  // 2. Update seeking value during drag/scrub
  const handleSeekChange = useCallback((value: number[]) => {
    const newTime = value[0];
    
    if (!isVideoLoaded || isSeeking === false) {
      console.warn("Ignoring seek change - not in seeking mode or video not loaded");
      return;
    }
    
    console.log(`Seek value changing to: ${newTime.toFixed(2)}s`);
    
    // Update the UI immediately for responsive feel
    setSeekingValue(newTime);
    
    // Debounce the visual preview update
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }
    
    // Update video time for preview, but not too frequently
    seekTimeoutRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        console.log(`Updating video preview time to: ${newTime.toFixed(2)}s`);
        video.currentTime = newTime;
      }
    }, 50);
  }, [isVideoLoaded, isSeeking]);

  // 3. End seeking - apply final value and resume if needed
  const handleSeekEnd = useCallback(() => {
    console.log("Seek operation ending");
    
    // Clear any pending timeouts
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
    
    const video = videoRef.current;
    if (!video) {
      setIsSeeking(false);
      return;
    }
    
    // Ensure video time is set to the final seek position
    try {
      console.log(`Setting final video time to: ${seekingValue.toFixed(2)}s`);
      video.currentTime = seekingValue;
      
      // Update all state after setting the time
      setCurrentTime(seekingValue);
      onTimeUpdate?.(seekingValue);
      
      // Resume playback if it was playing before seeking started
      if (isPlaying) {
        console.log("Resuming playback after seek");
        video.play().catch(error => {
          console.error("Error resuming playback after seek:", error);
        });
      }
    } catch (error) {
      console.error("Error during seek end:", error);
      toast("Failed to seek to position");
    } finally {
      // Always exit seeking mode
      setIsSeeking(false);
    }
  }, [seekingValue, isPlaying, onTimeUpdate]);
  
  // Handle video load events with improved error reporting
  const handleVideoLoaded = useCallback(() => {
    console.log("Video element successfully loaded");
    setIsVideoLoaded(true);
    setVideoError(null);
    setIsLoadingVideo(false);
    
    const video = videoRef.current;
    if (video) {
      const videoDuration = video.duration;
      if (videoDuration && !isNaN(videoDuration) && isFinite(videoDuration)) {
        console.log(`Video loaded with duration: ${videoDuration.toFixed(2)}s`);
        setDuration(videoDuration);
        onVideoLoaded?.(videoDuration);
      } else {
        console.warn("Video loaded but has invalid duration:", videoDuration);
      }
      
      // Ensure URL is passed to parent when video is ready
      if (videoUrl && onVideoUrlUpdate) {
        console.log("Video fully loaded, confirming URL to parent");
        onVideoUrlUpdate(videoUrl);
      }
    }
  }, [videoUrl, onVideoLoaded, onVideoUrlUpdate]);
  
  // Enhanced error handling
  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.target as HTMLVideoElement;
    let errorMessage = "Failed to load video. Please check the video file format and try again.";
    
    if (videoElement && videoElement.error) {
      const errorCode = videoElement.error.code;
      const errorMsg = videoElement.error.message;
      
      console.error(`Video error code: ${errorCode}, message: ${errorMsg}`);
      errorMessage = `Error loading video: ${errorMsg || `Code ${errorCode}`}`;
    }
    
    console.error("Video element error:", errorMessage);
    setVideoError(errorMessage);
    setIsVideoLoaded(false);
    setIsLoadingVideo(false);
    
    // Auto-retry on first attempt
    if (loadAttempts === 0) {
      console.log("First attempt failed, will retry loading video after delay");
      setTimeout(() => {
        setLoadAttempts(prev => prev + 1);
      }, 1000);
    }
  }, [loadAttempts]);
  
  // Manual retry function
  const retryLoadVideo = useCallback(() => {
    console.log("Manual retry requested");
    setLoadAttempts(prev => prev + 1);
  }, []);

  // Log major state changes for debugging
  useEffect(() => {
    console.log("VideoPlayer state updated:", { 
      isPlaying, 
      currentTime: Math.round(currentTime * 100) / 100, 
      duration: Math.round(duration * 100) / 100,
      hasVideoUrl: !!videoUrl,
      isVideoLoaded,
      videoError: videoError || "None",
      isLoadingVideo, 
      loadAttempts,
      isSeeking,
      seekingValue: Math.round(seekingValue * 100) / 100
    });
  }, [isPlaying, currentTime, duration, videoUrl, isVideoLoaded, videoError, isLoadingVideo, loadAttempts, isSeeking, seekingValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.src = "";
        video.load();
      }
      
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

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
