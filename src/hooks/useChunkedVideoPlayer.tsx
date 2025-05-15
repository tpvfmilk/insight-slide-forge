
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VideoChunk } from '@/services/videoChunkingService';

interface ChunkedVideoPlayerProps {
  videoMetadata: any;
  projectId: string;
  normalVideoPath?: string; // Fallback path if chunking is not available
}

export const useChunkedVideoPlayer = ({ videoMetadata, projectId, normalVideoPath }: ChunkedVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekingValue, setSeekingValue] = useState<number | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  
  // Chunked video specific state
  const [chunks, setChunks] = useState<VideoChunk[] | null>(null);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [activeChunkUrl, setActiveChunkUrl] = useState<string | null>(null);
  const [chunkSignedUrls, setChunkSignedUrls] = useState<string[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [chunkStartOffset, setChunkStartOffset] = useState(0);
  
  // Initialize chunks from metadata
  useEffect(() => {
    if (!videoMetadata) return;
    
    try {
      // Check if the video is chunked
      const isChunked = videoMetadata.chunked_video_metadata?.isChunked === true;
      
      if (isChunked && videoMetadata.chunked_video_metadata?.chunks) {
        const chunksData = videoMetadata.chunked_video_metadata.chunks;
        setChunks(chunksData);
        
        // Calculate total duration from all chunks
        const total = chunksData.reduce((acc: number, chunk: VideoChunk) => {
          return acc + (chunk.endTime - chunk.startTime);
        }, 0);
        
        setTotalDuration(total);
        
        // Load the first chunk
        loadChunk(0);
      } else if (normalVideoPath) {
        // Fallback to normal video if not chunked
        loadNormalVideo();
      } else {
        setVideoError("Video metadata is invalid");
        setIsLoadingVideo(false);
      }
    } catch (error) {
      console.error("Error initializing chunked video player:", error);
      setVideoError("Failed to initialize video player");
      setIsLoadingVideo(false);
    }
  }, [videoMetadata]);
  
  // Function to load a specific chunk
  const loadChunk = useCallback(async (index: number) => {
    if (!chunks || !chunks[index]) {
      setVideoError("Chunk not found");
      return;
    }
    
    setIsLoadingVideo(true);
    setVideoError(null);
    setCurrentChunkIndex(index);
    
    try {
      // Calculate the start offset for this chunk (sum of durations of all previous chunks)
      const offset = chunks.slice(0, index).reduce((acc: number, chunk: VideoChunk) => {
        return acc + (chunk.endTime - chunk.startTime);
      }, 0);
      setChunkStartOffset(offset);
      
      // Get a signed URL for the chunk
      const { data, error } = await supabase.storage
        .from('video_uploads')
        .createSignedUrl(chunks[index].chunkPath, 3600); // 1 hour expiry
        
      if (error || !data?.signedUrl) {
        console.error("Error getting signed URL for chunk:", error);
        setVideoError("Failed to load video chunk");
        setIsLoadingVideo(false);
        return;
      }
      
      // Update the active chunk URL
      setActiveChunkUrl(data.signedUrl);
      
      // If the video element is already loaded, try to pre-load the next chunk
      if (isVideoLoaded && index < chunks.length - 1) {
        preloadNextChunk(index + 1);
      }
    } catch (error) {
      console.error("Error loading chunk:", error);
      setVideoError("Failed to load video chunk");
      setIsLoadingVideo(false);
    }
  }, [chunks, isVideoLoaded]);
  
  // Function to pre-load the next chunk
  const preloadNextChunk = useCallback(async (index: number) => {
    if (!chunks || !chunks[index]) return;
    
    try {
      const { data } = await supabase.storage
        .from('video_uploads')
        .createSignedUrl(chunks[index].chunkPath, 3600);
        
      if (data?.signedUrl) {
        // Store the preloaded URL
        setChunkSignedUrls(prev => {
          const newUrls = [...prev];
          newUrls[index] = data.signedUrl;
          return newUrls;
        });
        
        // Create a hidden video element to preload the next chunk
        const preloadVideo = document.createElement('video');
        preloadVideo.src = data.signedUrl;
        preloadVideo.preload = 'auto';
        preloadVideo.load();
      }
    } catch (error) {
      console.error("Error preloading chunk:", error);
    }
  }, [chunks]);
  
  // Function to load the normal non-chunked video
  const loadNormalVideo = useCallback(async () => {
    if (!normalVideoPath) {
      setVideoError("No video path provided");
      setIsLoadingVideo(false);
      return;
    }
    
    setIsLoadingVideo(true);
    setVideoError(null);
    
    try {
      const { data, error } = await supabase.storage
        .from('video_uploads')
        .createSignedUrl(normalVideoPath, 3600);
        
      if (error || !data?.signedUrl) {
        console.error("Error getting signed URL for video:", error);
        setVideoError("Failed to load video");
        setIsLoadingVideo(false);
        return;
      }
      
      setVideoUrl(data.signedUrl);
      setActiveChunkUrl(data.signedUrl);
    } catch (error) {
      console.error("Error loading video:", error);
      setVideoError("Failed to load video");
      setIsLoadingVideo(false);
    }
  }, [normalVideoPath]);
  
  // Function to load all videos (retry loading)
  const loadVideos = useCallback(() => {
    setVideoError(null);
    setIsLoadingVideo(true);
    
    if (chunks && chunks.length > 0) {
      loadChunk(currentChunkIndex);
    } else {
      loadNormalVideo();
    }
  }, [chunks, currentChunkIndex, loadChunk, loadNormalVideo]);
  
  // Handle video loaded event
  const handleVideoLoaded = useCallback(() => {
    if (!videoRef.current) return;
    
    setIsLoadingVideo(false);
    setIsVideoLoaded(true);
    setDuration(videoRef.current.duration);
    
    // If this is a chunk, preload the next one if available
    if (chunks && currentChunkIndex < chunks.length - 1) {
      preloadNextChunk(currentChunkIndex + 1);
    }
  }, [chunks, currentChunkIndex, preloadNextChunk]);
  
  // Handle video error event
  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video error:", e);
    setVideoError("Error loading video");
    setIsLoadingVideo(false);
    setIsVideoLoaded(false);
  }, []);
  
  // Update currentTime during playback
  useEffect(() => {
    if (!videoRef.current || !isVideoLoaded) return;
    
    const updateCurrentTime = () => {
      if (videoRef.current && !isSeeking) {
        // Add the start offset of the current chunk to get the global time
        setCurrentTime(videoRef.current.currentTime + chunkStartOffset);
      }
    };
    
    // Check if we need to switch to the next chunk
    const checkForNextChunk = () => {
      if (
        videoRef.current && 
        chunks && 
        currentChunkIndex < chunks.length - 1 && 
        videoRef.current.currentTime >= videoRef.current.duration - 0.5 // When near the end
      ) {
        // Time to switch to the next chunk
        loadChunk(currentChunkIndex + 1).then(() => {
          // Auto-play the next chunk
          if (isPlaying && videoRef.current) {
            videoRef.current.play();
          }
        });
      }
    };
    
    const interval = setInterval(() => {
      updateCurrentTime();
      checkForNextChunk();
    }, 100);
    
    return () => clearInterval(interval);
  }, [videoRef, isVideoLoaded, isSeeking, isPlaying, chunks, currentChunkIndex, chunkStartOffset, loadChunk]);
  
  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    if (!videoRef.current || !isVideoLoaded) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
  }, [isPlaying, isVideoLoaded]);
  
  // Update isPlaying state when video plays/pauses
  useEffect(() => {
    if (!videoRef.current) return;
    
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    
    videoRef.current.addEventListener('play', onPlay);
    videoRef.current.addEventListener('pause', onPause);
    
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('play', onPlay);
        videoRef.current.removeEventListener('pause', onPause);
      }
    };
  }, [videoRef.current]);
  
  // Handle seeking
  const handleSeekChange = useCallback((value: number) => {
    setSeekingValue(value);
    setIsSeeking(true);
  }, []);
  
  const handleSeekCommit = useCallback((value: number) => {
    setIsSeeking(false);
    setSeekingValue(null);
    
    if (!chunks || chunks.length === 0) {
      // For non-chunked videos, just seek directly
      if (videoRef.current && isVideoLoaded) {
        videoRef.current.currentTime = value;
        setCurrentTime(value);
      }
      return;
    }
    
    // For chunked videos, find the correct chunk and seek within it
    let currentOffset = 0;
    let targetChunkIndex = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkDuration = chunk.endTime - chunk.startTime;
      
      if (value >= currentOffset && value < currentOffset + chunkDuration) {
        // Found the correct chunk
        targetChunkIndex = i;
        break;
      }
      
      currentOffset += chunkDuration;
    }
    
    // If we need to change chunks
    if (targetChunkIndex !== currentChunkIndex) {
      loadChunk(targetChunkIndex).then(() => {
        if (videoRef.current) {
          // Calculate time within the chunk
          const timeInChunk = value - currentOffset;
          videoRef.current.currentTime = timeInChunk;
          
          // If was playing, continue playing
          if (isPlaying) {
            videoRef.current.play();
          }
        }
      });
    } else if (videoRef.current) {
      // If staying in the same chunk, just seek within it
      const timeInChunk = value - chunkStartOffset;
      videoRef.current.currentTime = timeInChunk;
    }
  }, [chunks, currentChunkIndex, isVideoLoaded, isPlaying, chunkStartOffset, loadChunk]);
  
  // Skip forward/backward
  const skipForward = useCallback((seconds: number) => {
    const newTime = Math.min(totalDuration || duration, currentTime + seconds);
    handleSeekCommit(newTime);
  }, [currentTime, duration, totalDuration, handleSeekCommit]);
  
  const skipBackward = useCallback((seconds: number) => {
    const newTime = Math.max(0, currentTime - seconds);
    handleSeekCommit(newTime);
  }, [currentTime, handleSeekCommit]);
  
  // Format time to MM:SS
  const formatTime = useCallback((timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);
  
  return {
    videoRef,
    isPlaying,
    currentTime,
    duration: totalDuration || duration,
    seekingValue,
    isSeeking,
    isLoadingVideo,
    isVideoLoaded,
    videoUrl,
    videoError,
    togglePlayback,
    handleSeekChange,
    handleSeekCommit,
    skipForward,
    skipBackward,
    formatTime,
    handleVideoLoaded,
    handleVideoError,
    // Chunked video specific
    chunks,
    currentChunkIndex,
    activeChunkUrl,
    loadChunk,
    loadVideos
  };
};
