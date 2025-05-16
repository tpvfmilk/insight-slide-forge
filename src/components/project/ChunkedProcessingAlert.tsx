
import { useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAudioChunking } from "@/context/AudioChunkingContext";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Clock } from "lucide-react";

interface ChunkedProcessingAlertProps {
  projectId: string;
  originalVideoPath: string;
  onComplete?: () => void;
  autoProcess?: boolean; // Add option to auto-start processing
}

export const ChunkedProcessingAlert = ({
  projectId,
  originalVideoPath,
  onComplete,
  autoProcess = false,
}: ChunkedProcessingAlertProps) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(autoProcess);
  const [progress, setProgress] = useState<number>(0);
  const { prepareForChunkedProcessing, isPreparingChunks } = useAudioChunking();

  // Auto-start processing if autoProcess is true
  useState(() => {
    if (autoProcess && projectId && originalVideoPath) {
      handleStartProcessing();
    }
  });

  const handleStartProcessing = async () => {
    if (!projectId || !originalVideoPath) return;

    setIsProcessing(true);
    
    // Start processing simulation
    let progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 5;
      });
    }, 1000);

    // Actual processing
    const success = await prepareForChunkedProcessing(projectId, originalVideoPath);
    
    // Clear interval and set final progress
    clearInterval(progressInterval);
    setProgress(success ? 100 : 0);
    setIsProcessing(false);
    
    // Callback to refresh data
    if (success && onComplete) {
      onComplete();
    }
  };

  // If already processing, show the progress
  if (isPreparingChunks) {
    return (
      <Alert>
        <AlertTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 animate-spin" /> 
          Processing Large Video
        </AlertTitle>
        <AlertDescription>
          <div className="mt-2">
            <p className="text-sm mb-2">Breaking video into chunks for better processing...</p>
            <Progress value={progress} className="h-2" />
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // If flagged for automatic processing but not started yet
  if (autoProcess && !isPreparingChunks && !isProcessing) {
    return (
      <Alert>
        <AlertTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4" /> 
          Starting Automatic Processing
        </AlertTitle>
        <AlertDescription>
          <div className="mt-2">
            <p className="text-sm mb-2">Large video detected. Preparing to process audio...</p>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Manual trigger option
  return (
    <Alert>
      <AlertTitle className="flex items-center gap-2">Large Video Detected</AlertTitle>
      <AlertDescription>
        <div className="mt-2">
          <p className="text-sm mb-2">
            This video is too large for direct transcription. We need to break it into smaller chunks.
          </p>
          {isProcessing ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Processing audio...</p>
              <Progress value={progress} className="h-2" />
            </div>
          ) : (
            <Button onClick={handleStartProcessing} size="sm" className="mt-2 gap-2">
              Process Audio <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
