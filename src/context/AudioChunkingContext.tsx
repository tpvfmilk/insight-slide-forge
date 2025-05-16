
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { forceUpdateChunkingMetadata, initiateServerSideChunking } from '@/services/videoChunkingService';

interface AudioChunkingContextType {
  prepareForChunkedProcessing: (projectId: string, originalVideoPath: string) => Promise<boolean>;
  isPreparingChunks: boolean;
}

const AudioChunkingContext = createContext<AudioChunkingContextType | undefined>(undefined);

export function useAudioChunking() {
  const context = useContext(AudioChunkingContext);
  if (!context) {
    throw new Error('useAudioChunking must be used within an AudioChunkingProvider');
  }
  return context;
}

interface AudioChunkingProviderProps {
  children: ReactNode;
}

export function AudioChunkingProvider({ children }: AudioChunkingProviderProps) {
  const [isPreparingChunks, setIsPreparingChunks] = useState(false);

  const prepareForChunkedProcessing = async (projectId: string, originalVideoPath: string) => {
    if (!projectId || !originalVideoPath) {
      toast.error("Missing project information");
      return false;
    }

    setIsPreparingChunks(true);
    const toastId = "chunking-preparation";
    
    try {
      toast.loading("Preparing video for chunked processing...", { id: toastId });
      
      // First update the metadata to flag this video for chunking
      const result = await forceUpdateChunkingMetadata(projectId);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to prepare chunking metadata");
      }
      
      // Now initiate the server-side chunking process
      const chunkingResult = await initiateServerSideChunking(projectId, originalVideoPath);
      
      if (!chunkingResult.success) {
        throw new Error(chunkingResult.error || "Failed to prepare chunks");
      }
      
      toast.success("Video prepared for chunked processing", { id: toastId });
      return true;
    } catch (error: any) {
      console.error("[DEBUG] Error preparing for chunked processing:", error);
      toast.error(`Failed to prepare video: ${error.message}`, { id: toastId });
      return false;
    } finally {
      setIsPreparingChunks(false);
    }
  };

  return (
    <AudioChunkingContext.Provider value={{ prepareForChunkedProcessing, isPreparingChunks }}>
      {children}
    </AudioChunkingContext.Provider>
  );
}
