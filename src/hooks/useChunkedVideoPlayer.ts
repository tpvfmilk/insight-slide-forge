
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getChunkSignedUrls, VideoChunk } from "@/services/videoChunkingService";

interface UseChunkedVideoPlayerProps {
  videoMetadata?: any;
  projectId: string;
  normalVideoPath?: string;
}

export function useChunkedVideoPlayer({
  videoMetadata,
  projectId,
  normalVideoPath
}: UseChunkedVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekingValue, setSeekingValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [chunkUrls, setChunkUrls] = useState<string[]>([]);
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [isChunked, setIsChunked] = useState(false);
  const [chunks, setChunks] = useState<VideoChunk[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Format time display (seconds to MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Function to load videos based on videoMetadata
  const loadVideos = async () => {
    setIsLoadingVideo(true);
    setVideoError(null);
    
    try {
      // Check if video is chunked
      const chunkedMetadata = videoMetadata?.chunked_video_metadata;
      
      if (chunkedMetadata?.isChunked && chunkedMetadata?.chunks?.length > 0) {
        console.log("Loading chunked video playback...");
        setIsChunked(true);
        setChunks(chunkedMetadata.chunks);
        
        // Get signed URLs for all chunks
        const urls = await getChunkSignedUrls(chunkedMetadata.chunks);
        setChunkUrls(urls);
        
        // Set total duration from metadata
        setDuration(chunkedMetadata.originalDuration || 0);
        
        // Set initial chunk
        setActiveChunkIndex(0);
        setIsLoadingVideo(false);
      } else if (normalVideoPath) {
        console.log("Loading standard video playback...");
        setIsChunked(false);
        
        // Get a signed URL for the normal video
        const { data, error } = await supabase.storage
          .from('video_uploads')
          .createSignedUrl(normalVideoPath, 7200);
          
        if (error) {
          console.error("Error getting signed URL:", error);
          setVideoError("Couldn't create access link for video");
          setIsLoadingVideo(false);
          return;
        }
        
        // Set the first chunk URL to the normal video URL
        setChunkUrls([data.signedUrl]);
        setIsLoadingVideo(false);
      } else {
        setVideoError("No video source available");
        setIsLoadingVideo(false);
      }
    } catch (error) {
      console.error("Error loading videos:", error);
      setVideoError("Failed to load video");
      setIsLoadingVideo(false);
    }
  };

  // Function to determine which chunk should be active based on current time
  const updateActiveChunk = (currentTimeInSeconds: number) => {
    if (!isChunked || chunks.length === 0) return;
    
    for (let i = 0; i < chunks.length; i++) {
      if (currentTimeInSeconds >= chunks[i].startTime && 
          currentTimeInSeconds < chunks[i].endTime) {
        if (i !== activeChunkIndex) {
          console.log(`Switching to chunk ${i} at time ${currentTimeInSeconds}`);
          setActiveChunkIndex(i);
        }
        return;
      }
    }
  };

  // Handle seeking to a specific time across chunks
  const seekToTime = (timeInSeconds: number) => {
    if (!isChunked || chunks.length === 0) return;
    
    // Find the appropriate chunk for this time
    for (let i = 0; i < chunks.length; i++) {
      if (timeInSeconds >= chunks[i].startTime && 
          timeInSeconds < chunks[i].endTime) {
        
        // If we're already on this chunk, just seek within it
        if (i === activeChunkIndex && videoRef.current) {
          const relativeChunkTime = timeInSeconds - chunks[i].startTime;
          videoRef.current.currentTime = relativeChunkTime;
          return;
        }
        
        // Otherwise, we need to change chunks
        setActiveChunkIndex(i);
        
        // We'll seek to the correct position once the chunk loads
        // Store the target time relative to the chunk's start
        const relativeChunkTime = timeInSeconds - chunks[i].startTime;
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = relativeChunkTime;
          }
        }, 100);
        return;
      }
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
  };

  // Seek back 5 seconds
  const seekBack = () => {
    const newTime = Math.max(0, currentTime - 5);
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    
    if (isChunked) {
      seekToTime(newTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  // Seek forward 5 seconds
  const seekForward = () => {
    const newTime = Math.min(duration, currentTime + 5);
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    
    if (isChunked) {
      seekToTime(newTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  // Handle seeking via slider
  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekChange = (value: number[]) => {
    setSeekingValue(value[0]);
  };

  const handleSeekEnd = () => {
    const newTime = seekingValue;
    setCurrentTime(newTime);
    
    if (isChunked) {
      seekToTime(newTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    
    setIsSeeking(false);
  };

  // Handle video events
  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isSeeking) return;
    
    // Update current time relative to active chunk
    if (isChunked && chunks.length > 0) {
      const absoluteTime = video.currentTime + chunks[activeChunkIndex].startTime;
      setCurrentTime(absoluteTime);
      setSeekingValue(absoluteTime);
      
      // Check if we need to move to the next chunk
      if (video.currentTime >= (chunks[activeChunkIndex].endTime - chunks[activeChunkIndex].startTime - 0.5)) {
        // We're near the end of this chunk, prepare to switch to next chunk
        if (activeChunkIndex < chunks.length - 1) {
          console.log(`Near end of chunk ${activeChunkIndex}, preparing to switch to next chunk`);
          setActiveChunkIndex(activeChunkIndex + 1);
        }
      }
    } else {
      // For non-chunked videos, just use the current time
      setCurrentTime(video.currentTime);
      setSeekingValue(video.currentTime);
    }
  };

  const handleVideoEnded = () => {
    if (isChunked && activeChunkIndex < chunks.length - 1) {
      // Move to the next chunk
      setActiveChunkIndex(activeChunkIndex + 1);
      // It will autoplay when the new chunk loads
    } else {
      // End of video or last chunk
      setIsPlaying(false);
    }
  };
  
  const handleVideoLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    
    setIsVideoLoaded(true);
    setVideoError(null);
    
    if (!isChunked) {
      // For non-chunked videos, get duration from the video element
      setDuration(video.duration);
    }
    
    // If we were playing before, resume playback
    if (isPlaying) {
      video.play().catch(e => console.error("Error resuming playback:", e));
    }
  };
  
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error("Video error:", e);
    setVideoError("Failed to load video. Please check the video file format and try again.");
    setIsVideoLoaded(false);
  };

  // Load videos when the component mounts
  useEffect(() => {
    loadVideos();
    
    // Cleanup function
    return () => {
      setChunkUrls([]);
      setIsChunked(false);
    };
  }, [videoMetadata, normalVideoPath]);
  
  // Update video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleVideoTimeUpdate);
    video.addEventListener('ended', handleVideoEnded);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleVideoTimeUpdate);
      video.removeEventListener('ended', handleVideoEnded);
    };
  }, [isChunked, activeChunkIndex, chunks]);

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
    activeChunkUrl: chunkUrls[activeChunkIndex],
    isChunked,
    activeChunkIndex,
    loadVideos, // Expose loadVideos so it can be called from other components
    formatTime,
    togglePlayPause,
    seekBack,
    seekForward,
    handleSeekStart,
    handleSeekChange,
    handleSeekEnd,
    handleVideoLoaded,
    handleVideoError
  };
}
