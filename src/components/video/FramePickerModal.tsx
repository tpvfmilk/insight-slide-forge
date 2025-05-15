
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExtractedFrame, captureFrameFromVideo } from "@/services/clientFrameExtractionService";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Camera, Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface FramePickerModalProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  projectId: string;
  onFramesSelected: (frames: ExtractedFrame[]) => void;
  allExtractedFrames: ExtractedFrame[];
  existingFrames: ExtractedFrame[];
  videoMetadata?: any;
}

export function FramePickerModal({
  open,
  onClose,
  videoPath,
  projectId,
  onFramesSelected,
  allExtractedFrames,
  existingFrames,
  videoMetadata
}: FramePickerModalProps) {
  const [capturedFrames, setCapturedFrames] = useState<ExtractedFrame[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [capturedTimemarks, setCapturedTimemarks] = useState<number[]>([]);

  // Initialize with existing frames if provided
  useEffect(() => {
    if (existingFrames && existingFrames.length > 0) {
      setCapturedFrames(existingFrames);
      
      // Extract timemarks from existing frames
      const timemarks = existingFrames
        .filter(frame => frame.timestamp)
        .map(frame => {
          const timeParts = frame.timestamp.split(':').map(Number);
          if (timeParts.length === 2) {
            return timeParts[0] * 60 + timeParts[1];
          } else if (timeParts.length === 3) {
            return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
          }
          return 0;
        });
      
      setCapturedTimemarks(timemarks);
    } else {
      setCapturedFrames([]);
      setCapturedTimemarks([]);
    }
  }, [existingFrames]);

  // Handle video time updates
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Capture a frame at the current position
  const handleCaptureFrame = useCallback(async () => {
    setIsCapturing(true);
    
    try {
      // Format current time as MM:SS
      const minutes = Math.floor(currentTime / 60);
      const seconds = Math.floor(currentTime % 60);
      const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Check if we already have a frame at this timestamp
      const existingFrameIndex = capturedFrames.findIndex(f => f.timestamp === timestamp);
      if (existingFrameIndex !== -1) {
        toast.error("A frame at this timestamp already exists");
        setIsCapturing(false);
        return;
      }
      
      // Capture frame from video element
      const frameData = await captureFrameFromVideo(projectId, timestamp, currentTime);
      
      if (!frameData) {
        throw new Error("Failed to capture frame");
      }
      
      // Add to captured frames
      setCapturedFrames(prev => [...prev, frameData]);
      setCapturedTimemarks(prev => [...prev, currentTime]);
      
      toast.success("Frame captured successfully");
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast.error("Failed to capture frame");
    } finally {
      setIsCapturing(false);
    }
  }, [currentTime, projectId, capturedFrames]);

  // Remove a frame
  const handleRemoveFrame = useCallback((index: number) => {
    setCapturedFrames(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
    
    setCapturedTimemarks(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  // Save selected frames
  const handleSaveFrames = useCallback(() => {
    if (capturedFrames.length === 0) {
      toast.error("Please capture at least one frame");
      return;
    }
    
    onFramesSelected(capturedFrames);
  }, [capturedFrames, onFramesSelected]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Frame Picker</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Video Player - Now takes full width */}
          <div className="w-full">
            <VideoPlayer
              videoPath={videoPath}
              projectId={projectId}
              width={640}
              height={360}
              className="mx-auto mb-4"
              onTimeUpdate={handleTimeUpdate}
              capturedTimemarks={capturedTimemarks}
              isCapturingFrame={isCapturing}
              onCaptureFrame={handleCaptureFrame}
              videoMetadata={videoMetadata}
            />
            
            <div className="flex justify-center mt-2">
              <Button
                onClick={handleCaptureFrame}
                disabled={isCapturing}
                className="flex items-center"
              >
                <Camera className="h-4 w-4 mr-2" />
                {isCapturing ? "Capturing..." : "Capture Current Frame"}
              </Button>
            </div>
          </div>
          
          {/* Frame Library - Now below video, with more columns */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Selected Frames ({capturedFrames.length})</h4>
            
            <ScrollArea className="h-[180px]">
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {capturedFrames.map((frame, index) => (
                  <div key={`captured-${index}`} className="relative group">
                    <img
                      src={frame.imageUrl}
                      alt={`Frame at ${frame.timestamp}`}
                      className="rounded border border-muted h-24 w-full object-cover"
                    />
                    <span className="absolute bottom-0 left-0 bg-black/60 text-white text-xs px-1 rounded-tr">
                      {frame.timestamp}
                    </span>
                    <button
                      className="absolute top-0 right-0 bg-red-500/90 text-white rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveFrame(index)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                
                {capturedFrames.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground text-sm p-4">
                    No frames captured yet. Use the video player to navigate to the desired position and click "Capture Current Frame".
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveFrames}
                disabled={capturedFrames.length === 0}
              >
                <Check className="h-4 w-4 mr-1" />
                Apply {capturedFrames.length} Frames
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
