
import { useEffect, useRef } from 'react';
import { useProgressOperation, OperationType } from '@/context/ProgressContext';
import { getUploadStageMessage } from '@/utils/uploadProgressUtils';

// Hook for tracking upload operations with progress
export function useUploadProgress() {
  const { startOperation } = useProgressOperation();
  const activeOperationRef = useRef<{
    id: string;
    workflowId?: string;
    updateProgress: (progress: number, message?: string) => void;
    finishOperation: (success?: boolean, message?: string) => void;
  } | null>(null);

  // Cleanup function to ensure operation is marked as complete if component unmounts
  useEffect(() => {
    return () => {
      if (activeOperationRef.current) {
        activeOperationRef.current.finishOperation(false, 'Operation interrupted');
      }
    };
  }, []);

  // Create a progress handler for upload operations
  const createProgressHandler = (
    title: string = 'Uploading file',
    type: OperationType = 'upload',
    options?: {
      workflowName?: string;
      workflowId?: string;
      step?: number;
    }
  ) => {
    // Complete any existing operation
    if (activeOperationRef.current) {
      activeOperationRef.current.finishOperation(false, 'Operation superseded by new upload');
    }

    // Start a new operation
    const operation = startOperation(type, title, 'Preparing...', {
      initialProgress: 0,
      workflowName: options?.workflowName,
      workflowId: options?.workflowId,
      step: options?.step
    });
    
    activeOperationRef.current = operation;

    return (progress: number, stage?: string) => {
      const message = stage ? getUploadStageMessage(stage, progress) : `Progress: ${progress}%`;
      operation.updateProgress(progress, message);
      
      // Automatically complete when reaching 100%
      if (progress >= 100) {
        setTimeout(() => {
          if (activeOperationRef.current?.id === operation.id) {
            operation.finishOperation(true, 'Complete');
            activeOperationRef.current = null;
          }
        }, 1000);
      }
    };
  };

  // Complete the current operation
  const completeOperation = (success: boolean = true, message?: string) => {
    if (activeOperationRef.current) {
      activeOperationRef.current.finishOperation(success, message);
      activeOperationRef.current = null;
    }
  };

  return {
    createProgressHandler,
    completeOperation
  };
}

// Hook for tracking processing operations with progress
export function useProcessingProgress() {
  const { startOperation, startWorkflow } = useProgressOperation();

  // Start a processing operation
  const startProcessingOperation = (
    title: string,
    initialMessage: string = 'Starting...',
    type: OperationType = 'processing',
    options?: {
      workflowName?: string;
      workflowId?: string;
      step?: number;
    }
  ) => {
    const operation = startOperation(type, title, initialMessage, {
      initialProgress: 0,
      workflowName: options?.workflowName,
      workflowId: options?.workflowId,
      step: options?.step
    });
    
    return {
      id: operation.id,
      workflowId: operation.workflowId,
      updateProgress: operation.updateProgress,
      complete: (success: boolean = true, message?: string) => {
        operation.finishOperation(success, message);
      }
    };
  };
  
  // Start a multi-step workflow
  const startProcessingWorkflow = (
    workflowName: string,
    steps: {
      type: OperationType;
      title: string;
      message: string;
    }[]
  ) => {
    return startWorkflow(workflowName, steps);
  };

  return { 
    startProcessingOperation,
    startProcessingWorkflow
  };
}

// Create a hook for audio processing workflow
export function useAudioProcessingWorkflow() {
  const { startProcessingWorkflow } = useProcessingProgress();
  
  const startAudioProcessingWorkflow = () => {
    return startProcessingWorkflow("Audio Processing", [
      { 
        type: 'extraction', 
        title: 'Extract Audio', 
        message: 'Extracting audio from video file...' 
      },
      { 
        type: 'chunking', 
        title: 'Chunk Audio', 
        message: 'Breaking audio into manageable chunks...' 
      },
      { 
        type: 'processing', 
        title: 'Process Audio Chunks', 
        message: 'Creating audio segments from chunks...' 
      },
      { 
        type: 'upload', 
        title: 'Upload Audio Chunks', 
        message: 'Uploading audio chunks...' 
      },
      { 
        type: 'transcription', 
        title: 'Transcribe Audio', 
        message: 'Transcribing audio chunks...' 
      }
    ]);
  };
  
  return { startAudioProcessingWorkflow };
}
