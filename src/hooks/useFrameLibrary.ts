
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { mergeAndSaveFrames } from "@/utils/frameUtils";

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
  const [selectedFrames, setSelectedFrames] = useState<{[key: string]: boolean}>({});
  const [libraryFrames, setLibraryFrames] = useState<ExtractedFrame[]>([]);
  const [isUploadingFrames, setIsUploadingFrames] = useState(false);
  
  // Utility function to convert timestamp string to seconds
  const timeToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };
  
  // Initialize selected frames and library frames
  useEffect(() => {
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
      return newFrames.sort((a, b) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp));
    });
    
    // Automatically select the newly captured frame
    setSelectedFrames(prev => ({
      ...prev,
      [frame.id!]: true
    }));
    
    // Most importantly: Save the new frame to the project's frame library immediately
    // This ensures it persists even if the user doesn't apply it to a slide
    const updatedFrames = await mergeAndSaveFrames(projectId, [frame], libraryFrames);
    if (updatedFrames) {
      console.log(`Frame captured and saved to project library`);
    }
    
    // Call the onCapturedFrame callback if provided
    if (onCapturedFrame) {
      onCapturedFrame(frame);
    }
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
    setSelectedFrames(prev => {
      const updated = {...prev};
      delete updated[frameId];
      return updated;
    });
  };
  
  // Apply selected frames to slide
  const handleApplyFrames = async (onFramesSelected: (frames: ExtractedFrame[]) => void) => {
    // Get selected frames from library
    const selectedFramesList = libraryFrames.filter(frame => 
      frame.id && selectedFrames[frame.id]
    );
    
    // Sort frames by timestamp before applying
    const sortedFrames = [...selectedFramesList].sort((a, b) => {
      return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
    });
    
    if (sortedFrames.length === 0) {
      toast({
        title: "No frames selected",
        description: "Please select at least one frame to add to the slide",
      });
      return;
    }
    
    setIsUploadingFrames(true);
    
    try {
      // Double check: ensure all frames have valid permanent URLs (not blob URLs)
      const validFrames = sortedFrames.filter(frame => 
        frame.imageUrl && !frame.imageUrl.startsWith('blob:')
      );
      
      if (validFrames.length < sortedFrames.length) {
        const invalidFrames = sortedFrames.length - validFrames.length;
        console.warn(`${invalidFrames} frames have temporary URLs and will be skipped`);
        if (validFrames.length === 0) {
          toast({
            title: "No valid frames available",
            description: "All frames must have permanent URLs",
            variant: "destructive",
          });
          setIsUploadingFrames(false);
          return;
        } else {
          toast({
            title: "Some frames will be skipped",
            description: `${invalidFrames} frames have invalid URLs`,
            variant: "warning",
          });
        }
      }
      
      // Call the onFramesSelected callback with the selected frames
      // This will apply the selected frames to the current slide
      await onFramesSelected(validFrames);
    } catch (error) {
      console.error("Error in handleApplyFrames:", error);
      toast({
        title: "Failed to process selected frames",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUploadingFrames(false);
    }
  };
  
  return {
    selectedFrames,
    libraryFrames,
    isUploadingFrames,
    selectedFramesCount: Object.keys(selectedFrames).length,
    toggleFrameSelection,
    removeFrame,
    handleApplyFrames,
    addFrameToLibrary,
    timeToSeconds
  };
}
