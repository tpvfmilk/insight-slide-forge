
import { useState, useEffect } from "react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";

export function useFrameSelection({
  initialFrames = [],
  onFrameSelectionChange
}: {
  initialFrames?: ExtractedFrame[];
  onFrameSelectionChange?: (selectedFrames: {[key: string]: boolean}) => void;
}) {
  const [selectedFrames, setSelectedFrames] = useState<{[key: string]: boolean}>({});
  
  // Initialize selected frames with the initial frames
  useEffect(() => {
    if (initialFrames && initialFrames.length > 0) {
      const initialSelectedState: {[key: string]: boolean} = {};
      initialFrames.forEach(frame => {
        if (frame.id) {
          initialSelectedState[frame.id] = true;
        }
      });
      setSelectedFrames(initialSelectedState);
    }
  }, [initialFrames]);
  
  // Toggle selection of a frame
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
      
      // Call the change handler if provided
      if (onFrameSelectionChange) {
        onFrameSelectionChange(updated);
      }
      
      return updated;
    });
  };
  
  // Clear all selected frames
  const clearSelectedFrames = () => {
    setSelectedFrames({});
    if (onFrameSelectionChange) {
      onFrameSelectionChange({});
    }
  };
  
  // Select all frames from a list
  const selectAllFrames = (frames: ExtractedFrame[]) => {
    const newSelection: {[key: string]: boolean} = {};
    
    frames.forEach(frame => {
      if (frame.id) {
        newSelection[frame.id] = true;
      }
    });
    
    setSelectedFrames(newSelection);
    
    if (onFrameSelectionChange) {
      onFrameSelectionChange(newSelection);
    }
    
    toast.info(`Selected ${Object.keys(newSelection).length} frames`);
  };
  
  return {
    selectedFrames,
    setSelectedFrames,
    toggleFrameSelection,
    clearSelectedFrames,
    selectAllFrames,
    selectedFramesCount: Object.keys(selectedFrames).length
  };
}
