
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Interface for slides that matches the structure used in the project
 */
export interface Slide {
  id?: string;
  title?: string;
  content?: string;
  timestamp?: string;
  imageUrl?: string;
  transcriptTimestamps?: string[];
  imageUrls?: string[];
  [key: string]: any; // Allow for additional properties
}

/**
 * Gets frame usage statistics
 */
export function getFrameStatistics(
  extractedFrames: ExtractedFrame[],
  slides: Slide[]
) {
  // Total frames extracted
  const totalExtracted = extractedFrames.length;
  
  // Find all frames used in slides
  const usedFrameUrls = new Set<string>();
  
  if (slides && Array.isArray(slides)) {
    slides.forEach(slide => {
      // Check for single imageUrl
      if (slide.imageUrl) {
        usedFrameUrls.add(slide.imageUrl);
      }
      
      // Check for multiple imageUrls
      if (slide.imageUrls && Array.isArray(slide.imageUrls)) {
        slide.imageUrls.forEach(url => usedFrameUrls.add(url));
      }
    });
  }
  
  // Count used frames from our extracted frames
  const usedFrames = extractedFrames.filter(frame => 
    usedFrameUrls.has(frame.imageUrl)
  );
  
  // Get unused frames
  const unusedFrames = extractedFrames.filter(frame => 
    !usedFrameUrls.has(frame.imageUrl)
  );
  
  return {
    totalExtracted,
    usedCount: usedFrames.length,
    unusedCount: unusedFrames.length,
    unusedFrames
  };
}

/**
 * Merge frames from multiple sources, ensuring no duplicates
 * Returns the merged frames array
 */
export async function mergeAndSaveFrames(
  projectId: string,
  newFrames: ExtractedFrame[],
  existingFrames: ExtractedFrame[] = []
): Promise<ExtractedFrame[]> {
  try {
    console.log(`Merging ${newFrames.length} new frames with ${existingFrames.length} existing frames`);
    
    // First, get the latest frames from the project to ensure we're working with current data
    const { data: projectData, error: fetchError } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .single();
    
    if (fetchError) {
      console.error("Error fetching project frames:", fetchError);
      return existingFrames;
    }
    
    // Get current frames from project data (this ensures we have the most up-to-date frames)
    const currentProjectFrames = (projectData?.extracted_frames || []) as ExtractedFrame[];
    
    // Create a map for efficient merging
    const frameMap = new Map<string, ExtractedFrame>();
    
    // First add all project frames
    currentProjectFrames.forEach(frame => {
      if (frame.id) {
        frameMap.set(frame.id, frame);
      } else if (frame.timestamp) {
        frameMap.set(frame.timestamp, frame);
      }
    });
    
    // Then add all existing frames from state (might have newer updates)
    existingFrames.forEach(frame => {
      if (frame.id) {
        frameMap.set(frame.id, frame);
      } else if (frame.timestamp) {
        frameMap.set(frame.timestamp, frame);
      }
    });
    
    // Finally, add/override with new frames
    newFrames.forEach(frame => {
      const key = frame.id || frame.timestamp;
      if (key) {
        frameMap.set(key, frame);
      }
    });
    
    // Convert map back to array
    const mergedFrames = Array.from(frameMap.values());
    console.log(`Merged to ${mergedFrames.length} total frames`);
    
    // Save to project
    const { error } = await supabase
      .from('projects')
      .update({ extracted_frames: mergedFrames })
      .eq('id', projectId);
      
    if (error) {
      console.error("Error saving merged frames:", error);
      return mergedFrames;
    }
    
    console.log(`Saved ${mergedFrames.length} merged frames to project ${projectId}`);
    return mergedFrames;
  } catch (error) {
    console.error("Error in mergeAndSaveFrames:", error);
    return [...existingFrames, ...newFrames];
  }
}

/**
 * Delete frames from storage and project data
 */
export async function deleteFrames(
  projectId: string,
  framesToDelete: ExtractedFrame[],
  allFrames: ExtractedFrame[]
): Promise<boolean> {
  try {
    if (framesToDelete.length === 0) {
      return true;
    }
    
    // Create a set of frame IDs to delete for quick lookup
    const idsToDelete = new Set(framesToDelete.map(frame => frame.id));
    
    // Filter out frames being deleted
    const updatedFrames = allFrames.filter(frame => !idsToDelete.has(frame.id));
    
    // Update the project with the filtered frames
    const { error } = await supabase
      .from('projects')
      .update({ extracted_frames: updatedFrames })
      .eq('id', projectId);
    
    if (error) {
      console.error("Error updating project frames:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting frames:", error);
    return false;
  }
}

/**
 * Purge unused frames from storage and project data
 */
export async function purgeUnusedFrames(
  projectId: string,
  extractedFrames: ExtractedFrame[],
  slides: Slide[]
): Promise<boolean> {
  try {
    const { unusedFrames } = getFrameStatistics(extractedFrames, slides);
    
    if (unusedFrames.length === 0) {
      toast.info("No unused frames to purge");
      return true;
    }
    
    // Get file paths to delete from storage
    const filesToDelete: string[] = [];
    
    unusedFrames.forEach(frame => {
      // Extract the path from the URL
      try {
        const url = new URL(frame.imageUrl);
        const pathParts = url.pathname.split('/');
        // Find the position after "public" which should be the bucket name
        const publicIndex = pathParts.findIndex(part => part === "public");
        if (publicIndex >= 0 && publicIndex + 1 < pathParts.length) {
          // Join all parts after the bucket name to get the file path
          const filePath = pathParts.slice(publicIndex + 2).join('/');
          if (filePath) {
            filesToDelete.push(filePath);
          }
        }
      } catch (e) {
        console.error("Error parsing URL for frame:", frame.imageUrl, e);
      }
    });
    
    // Remove files from storage
    if (filesToDelete.length > 0) {
      const { error } = await supabase.storage
        .from('slide_stills')
        .remove(filesToDelete);
      
      if (error) {
        console.error("Error removing files from storage:", error);
        toast.error("Failed to remove some unused frames");
      }
    }
    
    // Update project's extracted_frames list to remove the unused frames
    const newExtractedFrames = extractedFrames.filter(frame => 
      !unusedFrames.includes(frame)
    );
    
    const { error: updateError } = await supabase
      .from('projects')
      .update({ extracted_frames: newExtractedFrames })
      .eq('id', projectId);
    
    if (updateError) {
      console.error("Error updating project extracted_frames:", updateError);
      toast.error("Failed to update project data");
      return false;
    }
    
    toast.success(`Successfully purged ${unusedFrames.length} unused frames`);
    return true;
  } catch (error) {
    console.error("Error purging unused frames:", error);
    toast.error("Failed to purge unused frames");
    return false;
  }
}

/**
 * Handle the frame selection from the manual frame picker
 */
export async function handleManualFrameSelectionComplete(
  projectId: string,
  selectedFrames: ExtractedFrame[],
  currentSlideIndex: number, 
  slides: Slide[],
  setSlides: (slides: Slide[]) => void,
  updateSlidesInDatabase?: (slides: Slide[]) => Promise<void>
) {
  if (!selectedFrames.length || !projectId) return false;

  try {
    // Update current slide by APPENDING selected frames to any existing frames
    const updatedSlides = [...slides];
    const currentSlide = updatedSlides[currentSlideIndex];
    
    // Get existing frame URLs from the slide
    const existingFrameUrls: string[] = [];
    
    // Check for single imageUrl (legacy)
    if (currentSlide.imageUrl) {
      existingFrameUrls.push(currentSlide.imageUrl);
    }
    
    // Check for imageUrls array (new approach)
    if (currentSlide.imageUrls && Array.isArray(currentSlide.imageUrls)) {
      existingFrameUrls.push(...currentSlide.imageUrls);
    }
    
    // Get URLs of newly selected frames
    const newFrameUrls = selectedFrames.map(frame => frame.imageUrl);
    
    // Combine existing and new URLs, removing duplicates
    const combinedUrls = [...new Set([...existingFrameUrls, ...newFrameUrls])];
    
    // Update slide with combined URLs
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      imageUrls: combinedUrls
    };
    
    // If there was a single imageUrl, remove it since we're using imageUrls array now
    if (updatedSlides[currentSlideIndex].imageUrl) {
      updatedSlides[currentSlideIndex].imageUrl = undefined;
    }
    
    // Update slides state
    setSlides(updatedSlides);

    // Update in database if function is provided
    if (updateSlidesInDatabase) {
      await updateSlidesInDatabase(updatedSlides);
    } else {
      // Default fallback if no update function provided
      const { error } = await supabase
        .from('projects')
        .update({ slides: updatedSlides })
        .eq('id', projectId);
        
      if (error) {
        throw error;
      }
    }

    if (selectedFrames.length > 1) {
      toast.success(`${selectedFrames.length} frames added to slide`);
    } else {
      toast.success(`Frame added to slide`);
    }
    
    return true;
  } catch (error) {
    console.error("Error handling manual frame selection:", error);
    toast.error("Failed to add selected frames to slide");
    return false;
  }
}
