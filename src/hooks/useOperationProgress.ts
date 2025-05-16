
import { useEffect, useRef } from 'react';
import { useProgressOperation, OperationType } from '@/context/ProgressContext';
import { getUploadStageMessage } from '@/utils/uploadProgressUtils';

// Hook for tracking upload operations with progress
export function useUploadProgress() {
  const { startOperation } = useProgressOperation();
  const activeOperationRef = useRef<{
    id: string;
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
    type: OperationType = 'upload'
  ) => {
    // Complete any existing operation
    if (activeOperationRef.current) {
      activeOperationRef.current.finishOperation(false, 'Operation superseded by new upload');
    }

    // Start a new operation
    const operation = startOperation(type, title, 'Preparing...', 0);
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
  const { startOperation } = useProgressOperation();

  // Start a processing operation
  const startProcessingOperation = (
    title: string,
    initialMessage: string = 'Starting...',
    type: OperationType = 'processing'
  ) => {
    const operation = startOperation(type, title, initialMessage, 0);
    
    return {
      updateProgress: operation.updateProgress,
      complete: (success: boolean = true, message?: string) => {
        operation.finishOperation(success, message);
      }
    };
  };

  return { startProcessingOperation };
}
