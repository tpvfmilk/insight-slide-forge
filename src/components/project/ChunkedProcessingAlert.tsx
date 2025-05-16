
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAudioChunking } from '@/context/AudioChunkingContext';

interface ChunkedProcessingAlertProps {
  projectId: string;
  originalVideoPath: string;
  onComplete?: () => void;
}

export function ChunkedProcessingAlert({ 
  projectId, 
  originalVideoPath, 
  onComplete 
}: ChunkedProcessingAlertProps) {
  const { prepareForChunkedProcessing, isPreparingChunks } = useAudioChunking();
  
  const handlePrepareForChunking = async () => {
    const success = await prepareForChunkedProcessing(projectId, originalVideoPath);
    if (success && onComplete) {
      onComplete();
    }
  };
  
  return (
    <Alert variant="destructive" className="mb-4 bg-gray-950 border-red-800 text-red-400">
      <AlertTriangle className="h-4 w-4 text-red-400" />
      <AlertTitle className="text-red-300">Video is too large for direct transcription</AlertTitle>
      <AlertDescription className="space-y-2 mt-2 text-gray-300">
        <p>This video file is too large for direct transcription and needs to be processed in chunks.</p>
        <div className="mt-4">
          <Button
            onClick={handlePrepareForChunking}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={isPreparingChunks}
          >
            {isPreparingChunks ? "Preparing..." : "Prepare for Chunked Processing"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
