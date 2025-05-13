
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { VideoPlayer } from "./VideoPlayer";
import { FrameLibrary } from "./FrameLibrary";
import { FrameCapture } from "./FrameCapture";
import { loadFramesFromProject, storeFrameInLibrary } from "@/services/frameStorageService";

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
  // State for the modal
  const [selectedFrames, setSelectedFrames] = useState<{[key: string]: boolean}>({});
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [capturedTimemarks, setCapturedTimemarks] = useState<number[]>([]);
  const [libraryFrames, setLibraryFrames] = useState<ExtractedFrame[]>([]);
  const [isUploadingFrames, setIsUploadingFrames] = useState(false);
  
  // Helper function to convert timestamp string to seconds
  const timeToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };
  
  // Initialize state when opening modal
  useEffect(() => {
    if (open) {
      // Initialize with existing frames selected
      const initialSelectedState: {[key: string]: boolean} = {};
      
      // Select all existing frames by default
      if (existingFrames && existingFrames.length > 0) {
        existingFrames.forEach(frame => {
          if (frame.id) {
            initialSelectedState[frame.id] = true;
          }
        });
      }
      
      setSelectedFrames(initialSelectedState);
      setCurrentTime(0);
      setIsUploadingFrames(false);
      
      // Load all project frames from allExtractedFrames
      if (allExtractedFrames && allExtractedFrames.length > 0) {
        console.log(`Loading ${allExtractedFrames.length} frames from project's extracted frames`);
        
        // Filter out any frames without valid URLs
        const validFrames = allExtractedFrames.filter(frame => 
          frame && frame.imageUrl && !frame.imageUrl.startsWith('blob:')
        );
        
        if (validFrames.length !== allExtractedFrames.length) {
          console.warn(`Filtered out ${allExtractedFrames.length - validFrames.length} frames with invalid URLs`);
        }
        
        // Sort frames by timestamp
        const sortedLibraryFrames = [...validFrames].sort((a, b) => {
          return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
        });
        
        // Add existing timemarks to seek bar
        const timemarks = sortedLibraryFrames.map(frame => timeToSeconds(frame.timestamp));
        setCapturedTimemarks(timemarks);
        
        setLibraryFrames(sortedLibraryFrames);
      } else {
        console.log('No existing frames found in project');
        setLibraryFrames([]);
        setCapturedTimemarks([]);
      }
      
      // Also load frames directly from the database to ensure we have the latest
      loadProjectFrames();
    }
  }, [open, existingFrames, allExtractedFrames]);
  
  // Load frames from the database
  const loadProjectFrames = async () => {
    if (!projectId) return;
    
    try {
      const frames = await loadFramesFromProject(projectId);
      
      if (frames && frames.length > 0) {
        // Sort frames by timestamp
        const sortedFrames = frames.sort((a, b) => {
          return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
        });
        
        // Update timemarks
        const timemarks = sortedFrames.map(frame => timeToSeconds(frame.timestamp));
        setCapturedTimemarks(timemarks);
        
        // Update library frames
        setLibraryFrames(sortedFrames);
      }
    } catch (error) {
      console.error("Error loading frames from project:", error);
    }
  };
  
  // Handle video time update
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };
  
  // Handle video loaded
  const handleVideoLoaded = (videoDuration: number) => {
    setDuration(videoDuration);
  };
  
  // Toggle selection of a frame in library
  const toggleFrameSelection = (frame: ExtractedFrame) => {
    if (!frame.id) return;
    
    setSelectedFrames(prev => {
      const updated = {...prev};
      
      // Toggle selection
      if (updated[frame.id!]) {
        delete updated[frame.id!];
      } else {
        updated[frame.id!] = true;
      }
      
      return updated;
    });
  };
  
  // Remove a frame from the library
  const removeFrame = (frameId: string) => {
    // Find the frame to remove
    const frameToRemove = libraryFrames.find(frame => frame.id === frameId);
    if (frameToRemove) {
      // Remove from captured timemarks if it exists there
      if (frameToRemove.timestamp) {
        const timeInSeconds = timeToSeconds(frameToRemove.timestamp);
        setCapturedTimemarks(prev => prev.filter(time => Math.abs(time - timeInSeconds) > 0.5));
      }
    }
    
    // Remove from library frames
    setLibraryFrames(prev => prev.filter(frame => frame.id !== frameId));
    
    // Remove from selected frames
    setSelectedFrames(prev => {
      const updated = {...prev};
      delete updated[frameId];
      return updated;
    });
  };
  
  // Handle frame captured
  const handleFrameCaptured = async (frame: ExtractedFrame, timeInSeconds: number) => {
    try {
      // Add to library frames
      setLibraryFrames(prev => {
        const newFrames = [...prev, frame];
        // Sort frames by timestamp
        return newFrames.sort((a, b) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp));
      });
      
      // Automatically select the newly captured frame
      setSelectedFrames(prev => ({
        ...prev,
        [frame.id!]: true
      }));
      
      // Add timemark to the seek bar
      setCapturedTimemarks(prev => [...prev, timeInSeconds]);
      
      // Store the frame in the project's frame library
      await storeFrameInLibrary(frame, projectId, libraryFrames);
      
      console.log(`Frame captured and stored with permanent URL: ${frame.imageUrl}`);
    } catch (error) {
      console.error("Error handling captured frame:", error);
    }
  };
  
  // Apply selected frames to slide
  const handleApplyFrames = async () => {
    // Get selected frames from library
    const selectedFramesList = libraryFrames.filter(frame => 
      frame.id && selectedFrames[frame.id]
    );
    
    // Sort frames by timestamp before applying
    const sortedFrames = [...selectedFramesList].sort((a, b) => {
      return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
    });
    
    if (sortedFrames.length === 0) {
      toast.info("No frames selected");
      return;
    }
    
    setIsUploadingFrames(true);
    const toastId = "processing-frames";
    toast.loading("Processing selected frames...", { id: toastId });
    
    try {
      // Double check: ensure all frames have valid permanent URLs (not blob URLs)
      const validFrames = sortedFrames.filter(frame => 
        frame.imageUrl && !frame.imageUrl.startsWith('blob:')
      );
      
      if (validFrames.length < sortedFrames.length) {
        const invalidFrames = sortedFrames.length - validFrames.length;
        console.warn(`${invalidFrames} frames have temporary URLs and will be skipped`);
        if (validFrames.length === 0) {
          toast.error("No valid frames available. All frames must have permanent URLs.", { id: toastId });
          setIsUploadingFrames(false);
          return;
        } else {
          toast.warning(`${invalidFrames} frames will be skipped due to invalid URLs`, { id: toastId });
        }
      }
      
      // Call the onFramesSelected callback with the selected frames
      await onFramesSelected(validFrames);
      
      // Toast will be handled by parent component
      toast.dismiss(toastId);
    } catch (error) {
      console.error("Error in handleApplyFrames:", error);
      toast.error("Failed to process selected frames", { id: toastId });
    } finally {
      setIsUploadingFrames(false);
    }
  };
  
  // Get count of selected frames
  const selectedFramesCount = Object.keys(selectedFrames).length;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogTitle>Frame Library</DialogTitle>
        
        {/* Main content area */}
        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* Video player component */}
          <VideoPlayer
            videoPath={videoPath}
            projectId={projectId}
            onTimeUpdate={handleTimeUpdate}
            onVideoLoaded={handleVideoLoaded}
            capturedTimemarks={capturedTimemarks}
          >
            {/* Capture frame button is rendered inside VideoPlayer */}
            <div className="absolute bottom-16 right-4">
              <FrameCapture
                videoUrl={videoUrl}
                currentTime={currentTime}
                duration={duration}
                projectId={projectId}
                onFrameCaptured={handleFrameCaptured}
              />
            </div>
          </VideoPlayer>
          
          <Separator />
          
          {/* Frame library component */}
          <FrameLibrary
            frames={libraryFrames}
            selectedFrames={selectedFrames}
            onSelectFrame={toggleFrameSelection}
            onRemoveFrame={removeFrame}
          />
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => {
            // Make sure to properly close and clean up
            toast.dismiss("processing-frames");
            toast.dismiss("capture-frame");
            onClose();
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyFrames} 
            className="gap-1"
            disabled={selectedFramesCount === 0 || isUploadingFrames}
          >
            {isUploadingFrames ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Insert {selectedFramesCount > 0 ? `${selectedFramesCount} Frame${selectedFramesCount !== 1 ? 's' : ''}` : 'to Slide'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
