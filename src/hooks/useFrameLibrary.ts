
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { mergeAndSaveFrames } from "@/utils/frameUtils";
import { useFrameSelection } from "./useFrameSelection";
import { 
  timeToSeconds, 
  removeFrameFromProject, 
  deleteMultipleFrames as deleteMultipleFramesUtil,
  sortFramesByTimestamp
} from "@/utils/frameLibraryUtils";

export function useFrameLibrary({
  projectId,
  existingFrames = [],
  allExtractedFrames = [],
  onCapturedFrame
}: {
  projectId: string;
  existingFrames?: ExtractedFrame[];
  allExtractedFrames?: ExtractedFrame[];
  onCapturedFrame?: (frame: ExtractedFrame) => void;
}) {
  const [libraryFrames, setLibraryFrames] = useState<ExtractedFrame[]>([]);
  const [isUploadingFrames, setIsUploadingFrames] = useState(false);
  
  // Use our new frame selection hook
  const frameSelection = useFrameSelection({
    initialFrames: existingFrames
  });
  
  // Initialize library frames
  useEffect(() => {
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
      const sortedLibraryFrames = sortFramesByTimestamp(validFrames);
      
      setLibraryFrames(sortedLibraryFrames);
    } else {
      console.log('No existing frames found in project');
      setLibraryFrames([]);
    }
  }, [existingFrames, allExtractedFrames]);
  
  // Add a new frame to the library
  const addFrameToLibrary = async (frame: ExtractedFrame) => {
    // Add to library frames
    setLibraryFrames(prev => {
      const newFrames = [...prev, frame];
      // Sort frames by timestamp
      return sortFramesByTimestamp(newFrames);
    });
    
    // Automatically select the newly captured frame
    frameSelection.setSelectedFrames(prev => ({
      ...prev,
      [frame.id!]: true
    }));
    
    // Save the new frame to the project's frame library
    const updatedFrames = await mergeAndSaveFrames(projectId, [frame], libraryFrames);
    if (updatedFrames) {
      console.log(`Frame captured and saved to project library`);
    }
    
    // Call the onCapturedFrame callback if provided
    if (onCapturedFrame) {
      onCapturedFrame(frame);
    }
  };
  
  // Remove a frame from the library
  const removeFrame = (frameId: string, onRemoveTimemark?: (timestamp: string) => void) => {
    // Find the frame to remove
    const frameToRemove = libraryFrames.find(frame => frame.id === frameId);
    if (frameToRemove) {
      // Call onRemoveTimemark if provided
      if (onRemoveTimemark && frameToRemove.timestamp) {
        onRemoveTimemark(frameToRemove.timestamp);
      }
    }
    
    // Remove from library frames
    setLibraryFrames(prev => prev.filter(frame => frame.id !== frameId));
    
    // Remove from selected frames
    frameSelection.setSelectedFrames(prev => {
      const updated = {...prev};
      delete updated[frameId];
      return updated;
    });
    
    // Remove from project database
    removeFrameFromProject(projectId, frameId);
  };
  
  // Delete multiple frames
  const deleteMultipleFrames = async (frameIds: string[]) => {
    if (!frameIds.length) return;
    
    const onSuccess = () => {
      // Update local state
      setLibraryFrames(prev => prev.filter(frame => !frameIds.includes(frame.id || '')));
      
      // Clear selection state for deleted frames
      frameSelection.setSelectedFrames(prev => {
        const updated = {...prev};
        frameIds.forEach(id => delete updated[id]);
        return updated;
      });
    };
    
    await deleteMultipleFramesUtil(projectId, frameIds, onSuccess);
  };
  
  // Apply selected frames to slide
  const handleApplyFrames = async (onFramesSelected: (frames: ExtractedFrame[]) => void) => {
    // Get selected frames from library
    const selectedFramesList = libraryFrames.filter(frame => 
      frame.id && frameSelection.selectedFrames[frame.id]
    );
    
    // Sort frames by timestamp before applying
    const sortedFrames = sortFramesByTimestamp(selectedFramesList);
    
    if (sortedFrames.length === 0) {
      toast.error("Please select at least one frame to add to the slide");
      return;
    }
    
    setIsUploadingFrames(true);
    
    try {
      // Ensure all frames have valid permanent URLs (not blob URLs)
      const validFrames = sortedFrames.filter(frame => 
        frame.imageUrl && !frame.imageUrl.startsWith('blob:')
      );
      
      if (validFrames.length < sortedFrames.length) {
        const invalidFrames = sortedFrames.length - validFrames.length;
        console.warn(`${invalidFrames} frames have temporary URLs and will be skipped`);
        if (validFrames.length === 0) {
          toast.error("All frames must have permanent URLs");
          setIsUploadingFrames(false);
          return;
        } else {
          toast("Some frames will be skipped", {
            description: `${invalidFrames} frames have invalid URLs`,
          });
        }
      }
      
      // Call the onFramesSelected callback with the selected frames
      await onFramesSelected(validFrames);
    } catch (error) {
      console.error("Error in handleApplyFrames:", error);
      toast.error(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsUploadingFrames(false);
    }
  };
  
  return {
    ...frameSelection,
    libraryFrames,
    isUploadingFrames,
    toggleFrameSelection: frameSelection.toggleFrameSelection,
    removeFrame,
    handleApplyFrames,
    addFrameToLibrary,
    timeToSeconds,
    deleteMultipleFrames
  };
}
