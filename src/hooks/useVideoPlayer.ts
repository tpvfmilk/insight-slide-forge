
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseStoragePath, createSignedVideoUrl } from "@/utils/videoPathUtils";

export function useVideoPlayer({
  videoPath,
  projectId
}: {
  videoPath: string;
  projectId: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekingValue, setSeekingValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Format time display (seconds to MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Function to load the video
  const loadVideo = async () => {
    if (!videoPath) {
      setVideoError("No video path provided");
      setIsLoadingVideo(false);
      return;
    }
    
    setIsLoadingVideo(true);
    setVideoError(null);
    
    try {
      console.log(`Attempting to load video from path: ${videoPath}`);
      
      // Parse the path to get bucket and file path
      const { bucketName, filePath } = parseStoragePath(videoPath);
      
      console.log(`Getting signed URL for ${bucketName}/${filePath}`);
      
      // Get a fresh signed URL with longer expiry
      const signedUrl = await createSignedVideoUrl(videoPath, 7200); // 2 hour expiry
      
      if (!signedUrl) {
        throw new Error("Couldn't create access link for video");
      }
      
      console.log("Got signed URL for video");
      setVideoUrl(signedUrl);
    } catch (error) {
      console.error("Error getting fresh video URL:", error);
      
      // Try alternate methods to get video URL
      try {
        if (projectId) {
          // If we have project ID, try to get source URL from project
          const { data: projectData } = await supabase
            .from('projects')
            .select('source_url, source_file_path')
            .eq('id', projectId)
            .single();
            
          if (projectData?.source_url) {
            console.log("Using project source URL as fallback");
            setVideoUrl(projectData.source_url);
            return;
          } else if (projectData?.source_file_path) {
            // Try with the source file path from project
            const altPath = projectData.source_file_path;
            const { bucketName: altBucket, filePath: altFilePath } = parseStoragePath(altPath);
            
            const signedUrl = await createSignedVideoUrl(altPath, 7200);
              
            if (signedUrl) {
              console.log("Using alternate file path from project");
              setVideoUrl(signedUrl);
              return;
            }
          }
        }
      } catch (fallbackError) {
        console.error("All fallback attempts failed:", fallbackError);
      }
      
      setVideoError("Failed to access video. The video might be unavailable or the format is not supported.");
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // Handle video playback control
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(error => {
        console.error("Error playing video:", error);
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
  };

  // Seek forward 5 seconds
  const seekForward = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
    setCurrentTime(video.currentTime);
    setSeekingValue(video.currentTime);
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
  };

  // Handle video load events
  const handleVideoLoaded = () => {
    setIsVideoLoaded(true);
    setVideoError(null);
    setIsLoadingVideo(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };
  
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error("Video error:", e);
    setVideoError("Failed to load video. Please check the video file format and try again.");
    setIsVideoLoaded(false);
    setIsLoadingVideo(false);
  };
  
  // Retry loading video
  const retryLoadVideo = () => {
    setLoadAttempts(prev => prev + 1);
    loadVideo();
  };

  // Load video when component mounts or videoPath changes
  useEffect(() => {
    loadVideo();
  }, [videoPath, loadAttempts]);

  // Update time display when video is playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const updateTime = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
        setSeekingValue(video.currentTime);
      }
    };
    
    video.addEventListener('timeupdate', updateTime);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
    };
  }, [isSeeking]);

  // Handle video duration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);
  
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

  return {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    seekingValue,
    isSeeking,
    videoError,
    isVideoLoaded,
    isLoadingVideo,
    videoUrl,
    formatTime,
    togglePlayPause,
    seekBack,
    seekForward,
    handleSeekStart,
    handleSeekChange,
    handleSeekEnd,
    retryLoadVideo,
    handleVideoLoaded,
    handleVideoError
  };
}
