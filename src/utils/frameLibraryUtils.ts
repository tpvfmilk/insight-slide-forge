
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Convert timestamp string to seconds
export const timeToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};

// Remove frame from project database
export const removeFrameFromProject = async (projectId: string, frameId: string) => {
  try {
    // Get current extracted frames from project
    const { data: projectData, error: fetchError } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .single();
    
    if (fetchError) {
      console.error("Error fetching project frames:", fetchError);
      return false;
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
      return false;
    }
    
    console.log(`Removed frame ${frameId} from project database`);
    return true;
  } catch (error) {
    console.error("Error in removeFrameFromProject:", error);
    return false;
  }
};

// Delete multiple frames from project
export const deleteMultipleFrames = async (
  projectId: string, 
  frameIds: string[],
  onSuccess?: () => void
) => {
  if (!frameIds.length) return false;
  
  try {
    // Get current extracted frames from project
    const { data: projectData, error: fetchError } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .single();
    
    if (fetchError) {
      console.error("Error fetching project frames:", fetchError);
      return false;
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
      return false;
    }
    
    // Call success callback if provided
    if (onSuccess) {
      onSuccess();
    }
    
    // Show success message
    toast.success(`Deleted ${frameIds.length} frames from library`);
    console.log(`Removed ${frameIds.length} frames from project database`);
    return true;
  } catch (error) {
    console.error("Error in deleteMultipleFrames:", error);
    toast.error("Failed to delete selected frames");
    return false;
  }
};

// Sort frames by timestamp
export const sortFramesByTimestamp = (frames: ExtractedFrame[]): ExtractedFrame[] => {
  return [...frames].sort((a, b) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp));
};
