
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2, X } from "lucide-react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// Import our new components and hooks
import { VideoPlayer } from "./VideoPlayer";
import { FrameLibraryGrid } from "./FrameLibraryGrid";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { useFrameCapture } from "@/hooks/useFrameCapture";
import { useFrameLibrary } from "@/hooks/useFrameLibrary";

export interface FramePickerModalProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  projectId: string;
  onFramesSelected: (frames: ExtractedFrame[]) => void;
  allExtractedFrames: ExtractedFrame[];
  existingFrames?: ExtractedFrame[];
}

export const FramePickerModal: React.FC<FramePickerModalProps> = ({
  open,
  onClose,
  videoPath,
  projectId,
  onFramesSelected,
  allExtractedFrames = [],
  existingFrames = []
}) => {
  // Use our custom hooks
  const videoPlayer = useVideoPlayer({ videoPath, projectId });
  const { videoRef, videoUrl, duration, isLoadingVideo, isVideoLoaded, formatTime } = videoPlayer;
  
  // Initialize the frame library
  const frameLibrary = useFrameLibrary({
    projectId,
    existingFrames,
    allExtractedFrames
  });
  
  // Initialize frame capture with callback to add frames to library
  const frameCapture = useFrameCapture({
    videoRef,
    projectId,
    videoUrl,
    duration,
    formatTime,
    onFrameCaptured: (frame) => {
      frameLibrary.addFrameToLibrary(frame);
    },
    allExtractedFrames
  });
  
  // Handle removing timemarks when frames are removed
  const handleFrameRemove = (frameId: string) => {
    const frame = frameLibrary.libraryFrames.find(f => f.id === frameId);
    if (frame && frame.timestamp) {
      const timeInSeconds = frameLibrary.timeToSeconds(frame.timestamp);
      frameCapture.setCapturedTimemarks(prev => 
        prev.filter(time => Math.abs(time - timeInSeconds) > 0.5)
      );
    }
    frameLibrary.removeFrame(frameId);
  };
  
  // Handle bulk deletion of selected frames
  const handleDeleteSelected = async () => {
    if (frameLibrary.selectedFramesCount === 0) {
      toast.info("No frames selected to delete");
      return;
    }
    
    const selectedFrames = frameLibrary.libraryFrames.filter(
      frame => frame.id && frameLibrary.selectedFrames[frame.id]
    );
    
    const frameIds = selectedFrames.map(frame => frame.id!);
    
    // Remove selected frames from captured timemarks
    selectedFrames.forEach(frame => {
      if (frame.timestamp) {
        const timeInSeconds = frameLibrary.timeToSeconds(frame.timestamp);
        frameCapture.setCapturedTimemarks(prev => 
          prev.filter(time => Math.abs(time - timeInSeconds) > 0.5)
        );
      }
    });
    
    // Delete frames from library and project
    await frameLibrary.deleteMultipleFrames(frameIds);
  };
  
  // Handle dialog clean up on close
  const handleClose = () => {
    // Make sure to properly clean up and dismiss any toasts
    toast.dismiss();
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] h-[90vh] flex flex-col p-6 gap-0">
        <DialogTitle className="mb-4">Frame Library</DialogTitle>
        
        {/* Main content container - fixed distribution with flex */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Video player section - increased fixed height */}
          <div className="flex justify-center mb-4" style={{ height: "400px", minHeight: "400px" }}>
            <VideoPlayer
              {...videoPlayer}
              capturedTimemarks={frameCapture.capturedTimemarks}
              isCapturingFrame={frameCapture.isCapturingFrame}
              onCaptureFrame={frameCapture.captureFrame}
            />
          </div>
          
          <Separator className="mb-4" />
          
          {/* Frame library section - flexible but with minimum height */}
          <div className="flex flex-col flex-grow overflow-hidden min-h-[200px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Frame Library</h3>
              <div className="text-sm text-muted-foreground">
                {frameLibrary.selectedFramesCount} frame{frameLibrary.selectedFramesCount !== 1 ? 's' : ''} selected
              </div>
            </div>
            
            {/* This is the scrollable container */}
            <div className="flex-grow bg-muted/30 rounded-md overflow-hidden">
              <FrameLibraryGrid 
                libraryFrames={frameLibrary.libraryFrames}
                selectedFrames={frameLibrary.selectedFrames}
                toggleFrameSelection={frameLibrary.toggleFrameSelection}
                removeFrame={handleFrameRemove}
              />
            </div>
          </div>
          
          {/* Hidden canvas for frame capture */}
          <canvas 
            ref={frameCapture.canvasRef} 
            className="hidden"
            width="1280"
            height="720"
          />
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {/* Add Delete Selected button */}
            <Button 
              onClick={handleDeleteSelected}
              variant="destructive"
              className="gap-1"
              disabled={frameLibrary.selectedFramesCount === 0 || frameLibrary.isUploadingFrames}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
            
            {/* Add to Slide button */}
            <Button 
              onClick={() => frameLibrary.handleApplyFrames(onFramesSelected)} 
              className="gap-1"
              disabled={frameLibrary.selectedFramesCount === 0 || frameLibrary.isUploadingFrames}
            >
              {frameLibrary.isUploadingFrames ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Add {frameLibrary.selectedFramesCount > 0 ? 
                    `${frameLibrary.selectedFramesCount} Frame${frameLibrary.selectedFramesCount !== 1 ? 's' : ''}` : 
                    'to Slide'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
