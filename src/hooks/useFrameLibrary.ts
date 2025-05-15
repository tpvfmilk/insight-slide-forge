
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { mergeAndSaveFrames } from "@/utils/frameUtils";
import { supabase } from "@/integrations/supabase/client";

export function useFrameLibrary({
  projectId,
  existingFrames = [],
  allExtractedFrames = [],
  onCapturedFrame,
  onFramesSelected
}: {
  projectId: string;
  existingFrames?: ExtractedFrame[];
  allExtractedFrames?: ExtractedFrame[];
  onCapturedFrame?: (frame: ExtractedFrame) => void;
  onFramesSelected?: (frames: ExtractedFrame[]) => void;
}) {
  const [selectedFrames, setSelectedFrames] = useState<{[key: string]: boolean}>({});
  const [libraryFrames, setLibraryFrames] = useState<ExtractedFrame[]>([]);
  const [isUploadingFrames, setIsUploadingFrames] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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
  
  // Check if a frame is selected
  const isFrameSelected = (frame: ExtractedFrame): boolean => {
    return !!frame.id && !!selectedFrames[frame.id];
  };
  
  // Handle search term change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
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
    
    // Remove from project database
    removeFrameFromProject(frameId);
  };
  
  // Remove frame from project database
  const removeFrameFromProject = async (frameId: string) => {
    try {
      // Get current extracted frames from project
      const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('extracted_frames')
        .eq('id', projectId)
        .single();
      
      if (fetchError) {
        console.error("Error fetching project frames:", fetchError);
        return;
      }
      
      // Filter out the frame to remove
      const currentFrames = (projectData?.extracted_frames || []) as ExtractedFrame[];
      const updatedFrames = currentFrames.filter(frame => frame.id !== frameId);
      
      // Update the project
      const { error } = await supabase
        .from('projects')
        .update({ extracted_frames: updatedFrames })
        .eq('id', projectId);
        
      if (error) {
        console.error("Error removing frame from project:", error);
        return;
      }
      
      console.log(`Removed frame ${frameId} from project database`);
    } catch (error) {
      console.error("Error in removeFrameFromProject:", error);
    }
  };
  
  // New function for bulk deletion of frames
  const deleteMultipleFrames = async (frameIds: string[]) => {
    if (!frameIds.length) return;
    
    try {
      // Get current extracted frames from project
      const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('extracted_frames')
        .eq('id', projectId)
        .single();
      
      if (fetchError) {
        console.error("Error fetching project frames:", fetchError);
        return;
      }
      
      // Filter out the frames to remove
      const currentFrames = (projectData?.extracted_frames || []) as ExtractedFrame[];
      const updatedFrames = currentFrames.filter(frame => !frameIds.includes(frame.id || ''));
      
      // Update the project
      const { error } = await supabase
        .from('projects')
        .update({ extracted_frames: updatedFrames })
        .eq('id', projectId);
        
      if (error) {
        console.error("Error removing frames from project:", error);
        toast.error("Failed to delete selected frames");
        return;
      }
      
      // Update local state
      setLibraryFrames(prev => prev.filter(frame => !frameIds.includes(frame.id || '')));
      
      // Clear selection state for deleted frames
      setSelectedFrames(prev => {
        const updated = {...prev};
        frameIds.forEach(id => delete updated[id]);
        return updated;
      });
      
      // Show success message
      toast.success(`Deleted ${frameIds.length} frames from library`);
      console.log(`Removed ${frameIds.length} frames from project database`);
    } catch (error) {
      console.error("Error in deleteMultipleFrames:", error);
      toast.error("Failed to delete selected frames");
    }
  };
  
  // Apply selected frames to slide
  const handleApplyFrames = () => {
    // Get selected frames from library
    const selectedFramesList = libraryFrames.filter(frame => 
      frame.id && selectedFrames[frame.id]
    );
    
    // Sort frames by timestamp before applying
    const sortedFrames = [...selectedFramesList].sort((a, b) => {
      return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
    });
    
    if (sortedFrames.length === 0) {
      toast.error("Please select at least one frame to add to the slide");
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
          toast.error("All frames must have permanent URLs");
          setIsUploadingFrames(false);
          return;
        } else {
          toast("Some frames will be skipped", {
            description: `${invalidFrames} frames have invalid URLs`,
          });
        }
      }
      
      // Call the onFramesSelected callback with the selected frames if provided
      if (onFramesSelected) {
        onFramesSelected(validFrames);
      }
    } catch (error) {
      console.error("Error in handleApplyFrames:", error);
      toast.error(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsUploadingFrames(false);
    }
  };

  // Filter library frames based on search term
  const frameLibrary = searchTerm 
    ? libraryFrames.filter(frame => frame.timestamp?.toLowerCase().includes(searchTerm.toLowerCase()))
    : libraryFrames;
  
  return {
    selectedFrames,
    libraryFrames: frameLibrary,
    isUploadingFrames,
    selectedFramesCount: Object.keys(selectedFrames).length,
    toggleFrameSelection,
    removeFrame,
    applySelectedFrames: handleApplyFrames,
    addFrameToLibrary,
    timeToSeconds,
    deleteMultipleFrames,
    searchTerm,
    isFrameSelected,
    handleSearchChange,
    clearSearch
  };
}
