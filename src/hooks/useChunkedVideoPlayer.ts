import { useState, useEffect, useRef, useCallback } from "react";
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
  const [seekingValue, setSeekingValue] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [chunkUrls, setChunkUrls] = useState<string[]>([]);
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [isChunked, setIsChunked] = useState(false);
  const [chunks, setChunks] = useState<VideoChunk[]>([]);
  const [activeChunkUrl, setActiveChunkUrl] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [chunkStartOffset, setChunkStartOffset] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasPlayingBeforeSeek = useRef(false);
  const preloadNextChunkTimeoutRef = useRef<number | null>(null);

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
        
        // Calculate total duration from metadata
        const totalDur = chunkedMetadata.originalDuration || 
          chunkedMetadata.chunks.reduce((acc: number, chunk: VideoChunk) => acc + (chunk.endTime - chunk.startTime), 0);
        setTotalDuration(totalDur);
        setDuration(totalDur);
        
        // Set initial chunk
        loadChunk(0);
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
        setActiveChunkUrl(data.signedUrl);
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

  // Calculate the time offset for a specific chunk
  const calculateChunkOffset = useCallback((chunkIndex: number): number => {
    if (!chunks || chunkIndex < 0) return 0;
    
    let offset = 0;
    for (let i = 0; i < chunkIndex; i++) {
      if (chunks[i]) {
        offset += (chunks[i].endTime - chunks[i].startTime);
      }
    }
    return offset;
  }, [chunks]);

  // Function to determine which chunk should be active based on current time
  const updateActiveChunk = useCallback((currentTimeInSeconds: number) => {
    if (!isChunked || chunks.length === 0) return;
    
    let accumulatedTime = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunkDuration = chunks[i].endTime - chunks[i].startTime;
      
      if (currentTimeInSeconds >= accumulatedTime && 
          currentTimeInSeconds < accumulatedTime + chunkDuration) {
        if (i !== activeChunkIndex) {
          console.log(`Switching to chunk ${i} at time ${currentTimeInSeconds}`);
          loadChunk(i);
          
          // Set the video's current time to the relative position in this chunk
          if (videoRef.current) {
            const relativeTime = currentTimeInSeconds - accumulatedTime;
            videoRef.current.currentTime = relativeTime;
          }
        }
        return;
      }
      
      accumulatedTime += chunkDuration;
    }
  }, [isChunked, chunks, activeChunkIndex]);

  // Function to load a specific chunk
  const loadChunk = useCallback(async (index: number) => {
    if (!chunks || !chunks[index]) {
      setVideoError("Chunk not found");
      return;
    }
    
    setIsLoadingVideo(true);
    setVideoError(null);
    
    const prevChunkIndex = activeChunkIndex;
    setActiveChunkIndex(index);
    
    try {
      // Calculate the start offset for this chunk
      const offset = calculateChunkOffset(index);
      setChunkStartOffset(offset);
      
      // Use the preloaded URL if available
      if (chunkUrls[index]) {
        setActiveChunkUrl(chunkUrls[index]);
        setIsLoadingVideo(false);
        
        // Preload the next chunk if available
        if (index < chunks.length - 1 && !chunkUrls[index + 1]) {
          preloadChunk(index + 1);
        }
        
        return;
      }
      
      // Otherwise get a new signed URL
      console.log(`Getting signed URL for chunk ${index}`);
      const { data, error } = await supabase.storage
        .from('video_uploads')
        .createSignedUrl(chunks[index].chunkPath, 7200);
        
      if (error || !data?.signedUrl) {
        console.error("Error getting signed URL for chunk:", error);
        setVideoError("Failed to load video chunk");
        setIsLoadingVideo(false);
        
        // Revert to previous chunk if there was one
        if (prevChunkIndex !== index && chunks[prevChunkIndex]) {
          loadChunk(prevChunkIndex);
        }
        return;
      }
      
      // Update the active chunk URL
      const newUrls = [...chunkUrls];
      newUrls[index] = data.signedUrl;
      setChunkUrls(newUrls);
      setActiveChunkUrl(data.signedUrl);
      
      // Preload the next chunk if available
      if (index < chunks.length - 1) {
        preloadChunk(index + 1);
      }
    } catch (error) {
      console.error("Error loading chunk:", error);
      setVideoError("Failed to load video chunk");
      
      // Revert to previous chunk if there was one
      if (prevChunkIndex !== index && chunks[prevChunkIndex]) {
        loadChunk(prevChunkIndex);
      }
    } finally {
      setIsLoadingVideo(false);
    }
  }, [chunks, activeChunkIndex, chunkUrls, calculateChunkOffset]);

  // Preload a chunk without making it active
  const preloadChunk = useCallback(async (index: number) => {
    if (!chunks?.[index] || chunkUrls[index]) return;
    
    try {
      console.log(`Preloading chunk ${index}`);
      const { data, error } = await supabase.storage
        .from('video_uploads')
        .createSignedUrl(chunks[index].chunkPath, 7200);
        
      if (!error && data?.signedUrl) {
        const newUrls = [...chunkUrls];
        newUrls[index] = data.signedUrl;
        setChunkUrls(newUrls);
      }
    } catch (err) {
      console.error(`Error preloading chunk ${index}:`, err);
    }
  }, [chunks, chunkUrls]);

  // Handle video playback control
  const togglePlayback = useCallback(() => {
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
  }, [isPlaying]);

  // Skip backward by seconds
  const skipBackward = useCallback((seconds: number = 5) => {
    const newTime = Math.max(0, currentTime - seconds);
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    
    if (isChunked) {
      updateActiveChunk(newTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, [currentTime, isChunked, updateActiveChunk]);

  // Skip forward by seconds
  const skipForward = useCallback((seconds: number = 5) => {
    const newTime = Math.min(totalDuration || duration, currentTime + seconds);
    setCurrentTime(newTime);
    setSeekingValue(newTime);
    
    if (isChunked) {
      updateActiveChunk(newTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, [currentTime, duration, totalDuration, isChunked, updateActiveChunk]);

  // Handle seeking via slider
  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
    wasPlayingBeforeSeek.current = isPlaying;
    
    // Pause video during seeking for smoother experience
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  const handleSeekChange = useCallback((value: number | number[]) => {
    const newValue = Array.isArray(value) ? value[0] : value;
    setSeekingValue(newValue);
  }, []);

  const handleSeekCommit = useCallback((value: number) => {
    const newTime = value;
    setCurrentTime(newTime);
    setIsSeeking(false);
    
    if (isChunked) {
      updateActiveChunk(newTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    
    // Resume playback if it was playing before seeking
    if (wasPlayingBeforeSeek.current && videoRef.current) {
      videoRef.current.play().catch(e => console.error("Error resuming playback:", e));
    }
  }, [isChunked, updateActiveChunk]);

  // Handle video loaded event
  const handleVideoLoaded = useCallback(() => {
    if (!videoRef.current) return;
    
    setIsVideoLoaded(true);
    setIsLoadingVideo(false);
    
    if (!isChunked) {
      setDuration(videoRef.current.duration);
    }
    
    // If we're playing a chunk, setup for correct relative time
    if (isChunked && chunks?.[activeChunkIndex]) {
      // If we were seeking to a specific time, set it now
      if (isSeeking && videoRef.current) {
        const relativeTime = seekingValue - chunkStartOffset;
        if (relativeTime >= 0) {
          videoRef.current.currentTime = relativeTime;
        }
        setIsSeeking(false);
      }
      
      // Resume playback if it was playing
      if (wasPlayingBeforeSeek.current) {
        videoRef.current.play().catch(e => console.error("Error resuming playback:", e));
      }
    }
    
    // Clear any existing preload timeout
    if (preloadNextChunkTimeoutRef.current) {
      clearTimeout(preloadNextChunkTimeoutRef.current);
    }
    
    // Preload the next chunk after a short delay if available
    if (isChunked && activeChunkIndex < chunks.length - 1) {
      preloadNextChunkTimeoutRef.current = setTimeout(() => {
        preloadChunk(activeChunkIndex + 1);
      }, 1000) as unknown as number;
    }
  }, [isChunked, chunks, activeChunkIndex, isSeeking, seekingValue, chunkStartOffset, preloadChunk]);
  
  // Handle video error event
  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video error:", e);
    setVideoError("Failed to load video. Please check the video file format and try again.");
    setIsVideoLoaded(false);
    setIsLoadingVideo(false);
  }, []);

  // Load videos when the component mounts or when dependencies change
  useEffect(() => {
    loadVideos();
    
    // Cleanup
    return () => {
      if (preloadNextChunkTimeoutRef.current) {
        clearTimeout(preloadNextChunkTimeoutRef.current);
      }
    };
  }, [videoMetadata, normalVideoPath]);

  // Update time display and check for chunk transitions
  useEffect(() => {
    if (!videoRef.current || !isVideoLoaded || !isChunked || chunks.length === 0) return;
    
    const updateTimeAndCheckChunk = () => {
      if (isSeeking) return;
      
      const video = videoRef.current;
      if (!video) return;
      
      // Update current global time based on current chunk and video position
      const globalTime = chunkStartOffset + video.currentTime;
      setCurrentTime(globalTime);
      setSeekingValue(globalTime);
      
      // Check if we're near the end of this chunk and need to transition
      const currentChunkDuration = chunks[activeChunkIndex].endTime - chunks[activeChunkIndex].startTime;
      const timeUntilEnd = currentChunkDuration - video.currentTime;
      
      if (isPlaying && timeUntilEnd < 0.5 && activeChunkIndex < chunks.length - 1) {
        // We're very close to the end, prepare to switch to the next chunk
        loadChunk(activeChunkIndex + 1);
      }
    };
    
    const intervalId = setInterval(updateTimeAndCheckChunk, 100);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isVideoLoaded, isChunked, chunks, activeChunkIndex, chunkStartOffset, isSeeking, isPlaying, loadChunk]);
  
  // Handle video play/pause/ended events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (isChunked && activeChunkIndex < chunks.length - 1) {
        // Move to next chunk on end
        loadChunk(activeChunkIndex + 1);
      } else {
        setIsPlaying(false);
      }
    };
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoRef, isChunked, chunks, activeChunkIndex, loadChunk]);

  // Format time to MM:SS
  const formatTime = useCallback((timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    videoRef,
    isPlaying,
    currentTime,
    duration: totalDuration || duration,
    seekingValue,
    isSeeking,
    videoError,
    isVideoLoaded,
    isLoadingVideo,
    activeChunkUrl,
    chunks,
    currentChunkIndex,
    loadVideos,
    loadChunk,
    formatTime,
    togglePlayback,
    skipBackward,
    skipForward,
    handleSeekStart,
    handleSeekChange,
    handleSeekCommit,
    handleVideoLoaded,
    handleVideoError
  };
}
