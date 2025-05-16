
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { forceUpdateChunkingMetadata } from '@/services/videoChunkingService';
import { extractAudioFromVideoFile } from '@/services/audioExtractionService';
import { 
  chunkAudioFile, 
  createActualAudioChunks, 
  uploadAudioChunks, 
  AudioChunkMetadata 
} from '@/services/audioChunkingService';
import { supabase } from '@/integrations/supabase/client';
import { useAudioProcessingWorkflow } from '@/hooks/useOperationProgress';

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
  const { startAudioProcessingWorkflow } = useAudioProcessingWorkflow();

  // Helper function to download a video from storage
  const downloadVideoFromStorage = async (filePath: string): Promise<File | null> => {
    try {
      // Get the public URL for the video
      const { data: urlData, error: urlError } = await supabase.storage
        .from('video_uploads')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (urlError || !urlData?.signedUrl) {
        console.error("Error getting signed URL:", urlError);
        return null;
      }
      
      // Download the file
      const response = await fetch(urlData.signedUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Create a file from the blob
      const fileName = filePath.split('/').pop() || 'video.mp4';
      return new File([blob], fileName, { type: blob.type });
    } catch (error) {
      console.error("Error downloading video:", error);
      return null;
    }
  };

  const prepareForChunkedProcessing = async (projectId: string, originalVideoPath: string) => {
    if (!projectId || !originalVideoPath) {
      toast.error("Missing project information");
      return false;
    }

    setIsPreparingChunks(true);
    const toastId = "chunking-preparation";
    
    // Create a workflow to track all the steps
    const workflow = startAudioProcessingWorkflow();
    
    try {
      toast.loading("Preparing video for chunked processing...", { id: toastId });
      
      // First update the metadata to flag this video for chunking
      const result = await forceUpdateChunkingMetadata(projectId);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to prepare chunking metadata");
      }
      
      // Step 1: Download the video - Start step 1
      workflow.updateWorkflowProgress(1, 0, "Downloading video file...");
      toast.loading("Downloading video for processing...", { id: toastId });
      
      const videoFile = await downloadVideoFromStorage(originalVideoPath);
      
      if (!videoFile) {
        throw new Error("Failed to download video file");
      }
      
      workflow.completeWorkflowStep(1, true, "Video downloaded successfully");
      
      // Step 2: Extract audio from video - Start step 2
      workflow.updateWorkflowProgress(2, 0, "Extracting audio from video...");
      toast.loading("Extracting audio from video...", { id: toastId });
      
      const audioBlob = await extractAudioFromVideoFile(videoFile);
      workflow.completeWorkflowStep(2, true, "Audio extracted successfully");
      
      // Step 3: Chunk the audio - Start step 3
      workflow.updateWorkflowProgress(3, 0, "Analyzing and chunking audio...");
      toast.loading("Chunking audio file...", { id: toastId });
      
      const chunkingResult = await chunkAudioFile(audioBlob, 60, 20);
      
      if (!chunkingResult.success || !chunkingResult.chunks.length) {
        throw new Error(chunkingResult.error || "Failed to chunk audio");
      }
      
      workflow.completeWorkflowStep(3, true, `Created ${chunkingResult.chunks.length} audio chunks`);
      
      // Step 4: Create actual audio chunks - Start step 4
      workflow.updateWorkflowProgress(4, 0, `Creating ${chunkingResult.chunks.length} audio chunks...`);
      toast.loading(`Creating ${chunkingResult.chunks.length} audio chunks...`, { id: toastId });
      
      const actualChunks = await createActualAudioChunks(
        audioBlob, 
        chunkingResult.chunks,
        (progress) => workflow.updateWorkflowProgress(4, progress)
      );
      
      if (!actualChunks.length) {
        throw new Error("Failed to create audio chunks");
      }
      
      workflow.completeWorkflowStep(4, true, `Successfully created ${actualChunks.length} audio chunks`);
      
      // Step 5: Upload audio chunks - Start step 5
      workflow.updateWorkflowProgress(5, 0, `Uploading ${actualChunks.length} audio chunks...`);
      toast.loading(`Uploading ${actualChunks.length} audio chunks...`, { id: toastId });
      
      const uploadedChunks = await uploadAudioChunks(
        projectId, 
        actualChunks,
        (progress) => workflow.updateWorkflowProgress(5, progress)
      );
      
      if (!uploadedChunks.length) {
        throw new Error("Failed to upload audio chunks");
      }
      
      workflow.completeWorkflowStep(5, true, `Successfully uploaded ${uploadedChunks.length} audio chunks`);
      
      toast.success(`Successfully prepared ${uploadedChunks.length} audio chunks for transcription`, { id: toastId });
      return true;
    } catch (error: any) {
      console.error("[DEBUG] Error preparing for chunked processing:", error);
      toast.error(`Failed to prepare video: ${error.message}`, { id: toastId });
      
      // Mark the current step as failed
      const currentStepIndex = [1, 2, 3, 4, 5].find(step => {
        const ops = workflow.operationIds[step - 1];
        return ops && ops.status === 'running';
      }) || workflow.operationIds.length;
      
      workflow.completeWorkflowStep(currentStepIndex, false, error.message);
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
