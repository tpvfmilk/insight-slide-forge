
import { useState, useEffect, useRef } from "react";
import { useVideoPlayer } from "./useVideoPlayer";
import { ExtendedVideoMetadata, ChunkMetadata } from "@/types/videoChunking";
import { getChunkTimemarks, getChunkInfoAtTime } from "@/services/videoChunkingService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  
  const [isGeneratingSignedUrl, setIsGeneratingSignedUrl] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  
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
  
  // Get signed URL for the video to ensure it works
  useEffect(() => {
    const getSignedUrl = async () => {
      if (videoPath && !signedUrl && !isGeneratingSignedUrl) {
        setIsGeneratingSignedUrl(true);
        
        try {
          // Strip any existing signed params from the URL
          const cleanPath = videoPath.split('?')[0];
          
          // Create a signed URL with an expiration
          const { data, error } = await supabase.storage
            .from('video_uploads') // Adjust if your bucket name is different
            .createSignedUrl(cleanPath, 3600); // 1 hour expiration
          
          if (error) {
            console.error("Error creating signed URL:", error);
            // Use the original URL as fallback
            setSignedUrl(videoPath);
          } else if (data?.signedUrl) {
            setSignedUrl(data.signedUrl);
            console.log("Generated signed URL for video access");
          }
        } catch (err) {
          console.error("Failed to generate signed URL:", err);
          setSignedUrl(videoPath); // Fallback to original URL
        } finally {
          setIsGeneratingSignedUrl(false);
        }
      }
    };
    
    getSignedUrl();
  }, [videoPath]);
  
  // Override the videoUrl with our signed URL when available
  const enhancedVideoUrl = signedUrl || videoPlayer.videoUrl;
  
  // Add an error handler specifically for chunks
  const handleChunkError = () => {
    toast.error("Failed to access video chunk. Try refreshing the page or check your connection.", {
      duration: 5000,
    });
    
    // Try to regenerate the signed URL
    setSignedUrl(null);
  };
  
  // Function to get chunk info at a specific time
  const getChunkInfoForTime = (time: number): string | null => {
    return getChunkInfoAtTime(time, chunkedMetadata);
  };
  
  // Return enhanced player with chunk functionality
  return {
    ...videoPlayer,
    videoUrl: enhancedVideoUrl,
    chunkTimemarks,
    getChunkInfoForTime,
    hasChunks: chunkTimemarks.length > 0,
    handleChunkError
  };
}
