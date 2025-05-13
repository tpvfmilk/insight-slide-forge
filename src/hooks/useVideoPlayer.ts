
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekingValue, setSeekingValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [durationUpdatedInDB, setDurationUpdatedInDB] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Debug log for props
  useEffect(() => {
    console.log("useVideoPlayer initialized with:", { 
      projectId, 
      videoPath: videoPath || "No path provided",
      hasTimeUpdateCallback: !!onTimeUpdate,
      hasVideoLoadedCallback: !!onVideoLoaded,
      hasUrlUpdateCallback: !!onVideoUrlUpdate 
    });
  }, [projectId, videoPath, onTimeUpdate, onVideoLoaded, onVideoUrlUpdate]);
  
  // Function to load the video with improved path handling and error logging
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
      
      // Critical: Notify parent immediately of URL update
      if (onVideoUrlUpdate) {
        console.log("Notifying parent component of video URL update");
        setTimeout(() => {
          onVideoUrlUpdate(signedUrl);
        }, 0);
      }
    } catch (error) {
      console.error("Error getting fresh video URL:", error);
      
      // Try alternate methods to get video URL
      if (projectId) {
        try {
          console.log("Attempting to get video URL from project data");
          // If we have project ID, try to get source URL from project
          const { data: projectData } = await supabase
            .from('projects')
            .select('source_url, source_file_path')
            .eq('id', projectId)
            .single();
            
          if (projectData?.source_url) {
            console.log("Using project source URL as fallback:", 
                       (projectData.source_url || "").substring(0, 50) + "...");
            setVideoUrl(projectData.source_url);
            
            // Important: Notify parent of URL update
            if (onVideoUrlUpdate) {
              onVideoUrlUpdate(projectData.source_url);
            }
            return;
          } else if (projectData?.source_file_path && projectData.source_file_path !== videoPath) {
            // Try with the source file path from project
            try {
              console.log("Trying with alternative source file path:", projectData.source_file_path);
              const altUrl = await getVideoSignedUrl(supabase, projectData.source_file_path);
              console.log("Using alternate file path from project");
              setVideoUrl(altUrl);
              
              // Important: Notify parent of URL update
              if (onVideoUrlUpdate) {
                onVideoUrlUpdate(altUrl);
              }
              return;
            } catch (innerError) {
              console.error("Error with alternate path:", innerError);
            }
          }
        } catch (fallbackError) {
          console.error("Error accessing fallback methods:", fallbackError);
        }
      }
      
      setVideoError(`Failed to access video (attempt ${loadAttempts + 1}). The video might be unavailable or the format is not supported.`);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [videoPath, loadAttempts, projectId, onVideoUrlUpdate]);
  
  // Load video on mount or when videoPath/loadAttempts changes
  useEffect(() => {
    loadVideo();
  }, [videoPath, loadAttempts, loadVideo]);
  
  // Handle video duration and update project metadata in database
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = async () => {
      const videoDuration = video.duration;
      setDuration(videoDuration);
      
      if (onVideoLoaded) {
        onVideoLoaded(videoDuration);
      }
      
      // Update the project's video_metadata with the accurate duration
      // Only do this once per video load to avoid unnecessary DB operations
      if (projectId && videoDuration && !durationUpdatedInDB) {
        try {
          await updateProjectDuration(supabase, projectId, videoDuration);
          console.log("Updated project with accurate video duration:", videoDuration);
          setDurationUpdatedInDB(true);
        } catch (error) {
          console.error("Error updating video duration in project:", error);
        }
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
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
        setSeekingValue(video.currentTime);
        onTimeUpdate?.(video.currentTime);
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
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  // Toggle play/pause
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(error => {
        console.error("Error playing video:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to play video"
        });
      });
    }
    
    setIsPlaying(!isPlaying);
  };
  
  // Seek back 5 seconds
  const seekBack = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, video.currentTime - 5);
    setCurrentTime(video.currentTime);
    setSeekingValue(video.currentTime);
    onTimeUpdate?.(video.currentTime);
  };
  
  // Seek forward 5 seconds
  const seekForward = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
    setCurrentTime(video.currentTime);
    setSeekingValue(video.currentTime);
    onTimeUpdate?.(video.currentTime);
  };
  
  // Handle seeking via slider
  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekChange = (value: number[]) => {
    setSeekingValue(value[0]);
  };

  const handleSeekEnd = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = seekingValue;
    setCurrentTime(seekingValue);
    setIsSeeking(false);
    onTimeUpdate?.(seekingValue);
  };
  
  // Handle video load events
  const handleVideoLoaded = () => {
    setIsVideoLoaded(true);
    setVideoError(null);
    setIsLoadingVideo(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      onVideoLoaded?.(videoRef.current.duration);
      
      // Additional notification of URL when video is fully loaded
      if (videoUrl && onVideoUrlUpdate) {
        console.log("Video fully loaded, notifying parent of final URL");
        onVideoUrlUpdate(videoUrl);
      }
    }
  };
  
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error("Video element error:", e);
    
    const videoElement = e.target as HTMLVideoElement;
    let errorMessage = "Failed to load video. Please check the video file format and try again.";
    
    // Get detailed error information if possible
    if (videoElement && videoElement.error) {
      const errorCode = videoElement.error.code;
      const errorMsg = videoElement.error.message;
      
      console.error(`Video error code: ${errorCode}, message: ${errorMsg}`);
      
      switch (errorCode) {
        case 1:
          errorMessage = "Video loading aborted.";
          break;
        case 2:
          errorMessage = "Network error while loading video.";
          break;
        case 3:
          errorMessage = "Error decoding video. The format may not be supported.";
          break;
        case 4:
          errorMessage = "Video is not available or compatible with this browser.";
          break;
        default:
          errorMessage = `Failed to load video: ${errorMsg || "Unknown error"}`;
      }
    }
    
    setVideoError(errorMessage);
    setIsVideoLoaded(false);
    setIsLoadingVideo(false);
    
    // Automatically retry once after a short delay if this is the first attempt
    if (loadAttempts === 0) {
      console.log("First attempt failed, will retry loading video after delay");
      setTimeout(() => {
        setLoadAttempts(prev => prev + 1);
      }, 1000);
    }
  };
  
  // Retry loading video
  const retryLoadVideo = () => {
    setLoadAttempts(prev => prev + 1);
  };

  // Log state changes for debugging
  useEffect(() => {
    console.log("VideoPlayer state updated:", { 
      isPlaying, 
      currentTime: Math.round(currentTime), 
      duration: Math.round(duration),
      hasVideoUrl: !!videoUrl,
      isVideoLoaded,
      videoError: videoError || "None",
      isLoadingVideo, 
      loadAttempts 
    });
  }, [isPlaying, currentTime, duration, videoUrl, isVideoLoaded, videoError, isLoadingVideo, loadAttempts]);

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
