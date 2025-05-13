
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { Project } from "@/services/projectService";
import { mergeAndSaveFrames } from "@/utils/frameUtils";

/**
 * Check if frames are needed for the slides
 * @param slides Array of slides to check
 * @returns True if frames are needed
 */
export const slidesNeedFrameExtraction = (slides: any[]): boolean => {
  if (!slides || slides.length === 0) return false;
  
  // Check if any slide is missing an image
  for (const slide of slides) {
    // Skip slides without timestamps (they don't need video frames)
    if (!slide.timestamp && !slide.transcriptTimestamps?.length) {
      continue;
    }
    
    // If a slide has a timestamp but no image, frames are needed
    if (!slide.imageUrl && (!slide.imageUrls || slide.imageUrls.length === 0)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Load frames from a project
 * @param projectId ID of the project
 * @returns Array of extracted frames
 */
export const loadExtractedFrames = async (projectId: string): Promise<ExtractedFrame[]> => {
  try {
    if (!projectId) {
      return [];
    }
    
    const { data: projectData } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .single();
      
    if (projectData?.extracted_frames && Array.isArray(projectData.extracted_frames)) {
      const frames = projectData.extracted_frames as ExtractedFrame[];
      console.log(`Loaded ${frames.length} extracted frames from project`);
      
      // Validate frames have proper URLs before setting state
      const validFrames = frames.filter(frame => 
        frame && frame.imageUrl && !frame.imageUrl.startsWith('blob:')
      );
      
      if (validFrames.length !== frames.length) {
        console.warn(`Filtered out ${frames.length - validFrames.length} frames with invalid URLs`);
      }
      
      // Sort frames by timestamp for better display
      return sortFramesByTimestamp(validFrames);
    }
    
    return [];
  } catch (error) {
    console.error("Error loading extracted frames:", error);
    return [];
  }
};

/**
 * Sort frames by their timestamp
 * @param frames Frames to sort
 * @returns Sorted array of frames
 */
export const sortFramesByTimestamp = (frames: ExtractedFrame[]): ExtractedFrame[] => {
  return [...frames].sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    
    // Convert timestamps to seconds for comparison
    const aTimeParts = a.timestamp.split(':').map(Number);
    const bTimeParts = b.timestamp.split(':').map(Number);
    
    const aSeconds = aTimeParts.length === 2 
      ? aTimeParts[0] * 60 + aTimeParts[1]
      : aTimeParts[0] * 3600 + aTimeParts[1] * 60 + aTimeParts[2];
      
    const bSeconds = bTimeParts.length === 2 
      ? bTimeParts[0] * 60 + bTimeParts[1]
      : bTimeParts[0] * 3600 + bTimeParts[1] * 60 + bTimeParts[2];
      
    return aSeconds - bSeconds;
  });
};

/**
 * Extract all timestamps from slides
 * @param slides Array of slides to extract timestamps from
 * @returns Array of unique timestamps
 */
export const extractTimestampsFromSlides = (slides: any[]): string[] => {
  if (!Array.isArray(slides)) return [];
  
  const timestamps: string[] = [];
  
  slides.forEach(slide => {
    if (slide && typeof slide === 'object') {
      if ('timestamp' in slide && typeof slide.timestamp === 'string') {
        timestamps.push(slide.timestamp);
      }
      
      if ('transcriptTimestamps' in slide && Array.isArray(slide.transcriptTimestamps)) {
        slide.transcriptTimestamps.forEach((timestamp: any) => {
          if (typeof timestamp === 'string') {
            timestamps.push(timestamp);
          }
        });
      }
    }
  });
  
  // Remove duplicates
  return [...new Set(timestamps)];
};

/**
 * Update slides with extracted frames
 * @param projectId ID of the project
 * @param frames Frames to apply to slides
 * @returns True if update was successful
 */
export const updateSlidesWithExtractedFrames = async (
  projectId: string, 
  frames: ExtractedFrame[]
): Promise<boolean> => {
  if (!projectId) return false;
  
  try {
    // Get current project data
    const { data: projectData } = await supabase
      .from('projects')
      .select('slides')
      .eq('id', projectId)
      .single();
      
    if (!projectData || !projectData.slides) {
      console.error("No slides found in project");
      return false;
    }
    
    const slides = projectData.slides as any[];
    const updatedSlides = [...slides];
    
    // Create a map of timestamps to frames for quick lookup
    const frameMap = new Map<string, ExtractedFrame>();
    frames.forEach(frame => {
      if (frame.timestamp) {
        frameMap.set(frame.timestamp, frame);
      }
    });
    
    // Update each slide with matching frames
    let updatedCount = 0;
    
    updatedSlides.forEach((slide, index) => {
      if (slide.timestamp && frameMap.has(slide.timestamp)) {
        const frame = frameMap.get(slide.timestamp)!;
        
        // Convert from single imageUrl to imageUrls array
        if (slide.imageUrl && !slide.imageUrls) {
          updatedSlides[index] = {
            ...updatedSlides[index],
            imageUrls: [slide.imageUrl, frame.imageUrl],
            imageUrl: undefined // Clear the single imageUrl
          };
        } else if (slide.imageUrls && Array.isArray(slide.imageUrls)) {
          // Add to the existing imageUrls array if not already there
          if (!slide.imageUrls.includes(frame.imageUrl)) {
            updatedSlides[index] = {
              ...updatedSlides[index],
              imageUrls: [...slide.imageUrls, frame.imageUrl]
            };
          }
        } else {
          // First image for this slide
          updatedSlides[index] = {
            ...updatedSlides[index],
            imageUrls: [frame.imageUrl]
          };
        }
        
        updatedCount++;
      }
    });
    
    // If no slides were updated, don't bother with database call
    if (updatedCount === 0) {
      console.log("No slides matched the provided frames");
      return true; // Still return true as this isn't a failure case
    }
    
    // Update the project with the modified slides
    const { error } = await supabase
      .from('projects')
      .update({
        slides: updatedSlides,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
      
    if (error) {
      console.error("Error updating slides with frames:", error);
      throw error;
    }
    
    console.log(`Updated ${updatedCount} slides with frames`);
    return true;
  } catch (error) {
    console.error("Error in updateSlidesWithExtractedFrames:", error);
    toast.error("Failed to update slides with frames");
    return false;
  }
};

/**
 * Handle manual frame selection
 * @param projectId ID of the project
 * @param selectedFrames Frames selected by the user
 * @param existingFrames Frames already in the project
 * @returns True if operation was successful
 */
export const handleManualFrameSelection = async (
  projectId: string,
  selectedFrames: ExtractedFrame[],
  existingFrames: ExtractedFrame[]
): Promise<boolean> => {
  if (!projectId) return false;
  
  if (!selectedFrames || selectedFrames.length === 0) {
    toast.info("No frames were selected");
    return false;
  }
  
  try {
    console.log(`Processing ${selectedFrames.length} selected frames for project ${projectId}`);
    
    // Verify all frames have valid permanent URLs
    const invalidFrames = selectedFrames.filter(frame => 
      !frame.imageUrl || 
      frame.imageUrl.startsWith('blob:') || 
      !frame.timestamp
    );
    
    if (invalidFrames.length > 0) {
      console.error("Cannot update slides with invalid URLs:", invalidFrames);
      toast.error("Cannot save frames with temporary URLs. Please try capturing frames again.");
      return false;
    }
    
    // Use the utility function to merge and save frames
    // This ensures all frames are preserved in the project
    const combinedFrames = await mergeAndSaveFrames(projectId, selectedFrames, existingFrames);
    
    if (!combinedFrames) {
      console.error("Failed to merge frames");
      toast.error("Failed to store frames");
      return false;
    }
    
    // Now update the slides to show the selected frames
    const success = await updateSlidesWithExtractedFrames(projectId, selectedFrames);
    
    if (!success) {
      console.error("Failed to update slides with frames");
      toast.error("Failed to update slides with selected frames");
      return false;
    }
    
    console.log(`Successfully applied ${selectedFrames.length} frames to slide, library now has ${combinedFrames.length} frames`);
    return true;
  } catch (error) {
    console.error("Error in handleManualFrameSelection:", error);
    toast.error("An error occurred while processing the selected frames");
    return false;
  }
};
