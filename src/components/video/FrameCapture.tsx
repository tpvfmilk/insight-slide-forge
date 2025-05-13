
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { uploadFrameToStorage } from "@/services/frameStorageService";

interface FrameCaptureProps {
  videoUrl: string | null;
  currentTime: number;
  duration: number;
  projectId: string;
  onFrameCaptured: (frame: ExtractedFrame, timeInSeconds: number) => void;
}

export const FrameCapture = ({
  videoUrl,
  currentTime,
  duration,
  projectId,
  onFrameCaptured
}: FrameCaptureProps) => {
  const [isCapturingFrame, setIsCapturingFrame] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Format time display (seconds to MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Create a placeholder frame when capture fails
  const createPlaceholderFrame = async (timeInSeconds: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("Failed to create placeholder frame");
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error("Failed to create placeholder frame");
      return;
    }
    
    // Set canvas size if not already set
    canvas.width = 640;
    canvas.height = 360;
    
    // Format timestamp
    const timestamp = formatTime(timeInSeconds);
    
    // Draw placeholder
    ctx.fillStyle = "#2563eb"; // Blue background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text explanation
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Frame at ${timestamp}`, canvas.width / 2, canvas.height / 2 - 15);
    ctx.font = "18px Arial";
    ctx.fillText("Could not extract frame from video", canvas.width / 2, canvas.height / 2 + 20);
    
    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        // Upload placeholder to storage
        const permanentUrl = await uploadFrameToStorage(blob, timestamp, projectId);
        
        if (!permanentUrl) {
          toast.error("Failed to upload placeholder frame");
          return;
        }
        
        // Generate unique ID for the frame
        const frameId = `frame-${Date.now()}-placeholder`;
        
        // Create a new extracted frame with permanent URL
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl: permanentUrl, // Use permanent URL from storage
          timestamp,
          isPlaceholder: true
        };
        
        // Pass the frame to the parent component
        onFrameCaptured(newFrame, timeInSeconds);
        
        toast.info(`Placeholder frame created at ${timestamp}`);
      } else {
        toast.error("Failed to create placeholder frame");
      }
    }, "image/jpeg", 0.95);
  };
  
  // Capture current frame using the improved extraction service
  const captureFrame = async () => {
    if (!videoUrl || isCapturingFrame) return;
    
    try {
      setIsCapturingFrame(true);
      
      // Store current time
      const currentTimePosition = currentTime;
      const timestamp = formatTime(currentTimePosition);
      
      const toastId = "capture-frame";
      toast.loading(`Capturing frame at ${timestamp}...`, { id: toastId });
      
      // Use our advanced frame extraction to get a good quality frame
      const extractedFrames = await extractFramesFromVideoUrl(
        videoUrl, 
        [timestamp],
        undefined,
        duration,
        {
          captureAttempts: 5, // More attempts
          captureOffsets: [-0.1, 0, 0.1, 0.2, -0.2, 0.5, -0.5, 0.8, -0.8], // More offsets
          minContentThreshold: 0.02 // Slightly lower threshold
        }
      );
      
      if (extractedFrames && extractedFrames.length > 0) {
        const { frame, timestamp: extractedTimestamp } = extractedFrames[0];
        
        // Upload the frame to storage to get a permanent URL
        const permanentUrl = await uploadFrameToStorage(frame, extractedTimestamp, projectId);
        
        if (!permanentUrl) {
          toast.error(`Failed to upload frame at ${timestamp}`, { id: toastId });
          createPlaceholderFrame(currentTimePosition);
          return;
        }
        
        // Create a new extracted frame with permanent URL
        const frameId = `frame-${Date.now()}-${extractedTimestamp}`;
        
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl: permanentUrl, // Use permanent URL from storage
          timestamp: extractedTimestamp,
          isPlaceholder: false
        };
        
        // Pass the frame to the parent component
        onFrameCaptured(newFrame, currentTimePosition);
        
        toast.success(`Frame captured at ${timestamp}`, { id: toastId });
      } else {
        // Create placeholder if extraction failed
        createPlaceholderFrame(currentTimePosition);
        
        toast.error(`Could not capture frame at ${timestamp}`, { id: toastId });
      }
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast.error(`Failed to capture frame: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        id: 'capture-frame'
      });
    } finally {
      setIsCapturingFrame(false);
    }
  };

  return (
    <>
      <Button 
        variant="secondary" 
        size="sm"
        onClick={captureFrame}
        className="flex items-center space-x-1"
        disabled={!videoUrl || isCapturingFrame}
      >
        {isCapturingFrame ? (
          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Camera className="h-4 w-4 mr-1" />
        )}
        {isCapturingFrame ? 'Capturing...' : 'Capture Frame'}
      </Button>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </>
  );
};
