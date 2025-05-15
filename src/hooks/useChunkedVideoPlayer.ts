
import { useState, useEffect } from "react";
import { useVideoPlayer } from "./useVideoPlayer";
import { ExtendedVideoMetadata, ChunkMetadata } from "@/types/videoChunking";
import { getChunkTimemarks, getChunkInfoAtTime } from "@/services/videoChunkingService";

export function useChunkedVideoPlayer({
  videoPath,
  projectId,
  videoMetadata
}: {
  videoPath: string;
  projectId: string;
  videoMetadata?: any; // Accept any metadata from project or video
}) {
  // Get all standard video player functionality
  const videoPlayer = useVideoPlayer({
    videoPath,
    projectId
  });
  
  // Extract chunk data from metadata
  const [chunkTimemarks, setChunkTimemarks] = useState<number[]>([]);
  const [chunkedMetadata, setChunkedMetadata] = useState<ExtendedVideoMetadata | null>(null);
  
  // Extract chunk timemarks when metadata changes
  useEffect(() => {
    if (videoMetadata) {
      // Cast to our extended type for TypeScript
      const typedMetadata = videoMetadata as ExtendedVideoMetadata;
      setChunkedMetadata(typedMetadata);
      
      // Get array of chunk start times
      const timemarks = getChunkTimemarks(typedMetadata);
      setChunkTimemarks(timemarks);
    }
  }, [videoMetadata]);
  
  // Function to get chunk info at a specific time
  const getChunkInfoForTime = (time: number): string | null => {
    return getChunkInfoAtTime(time, chunkedMetadata);
  };
  
  // Return enhanced player with chunk functionality
  return {
    ...videoPlayer,
    chunkTimemarks,
    getChunkInfoForTime,
    hasChunks: chunkTimemarks.length > 0
  };
}
