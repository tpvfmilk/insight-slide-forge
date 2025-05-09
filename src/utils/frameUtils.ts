
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
      // URL format is typically like: https://[bucket-url]/storage/v1/object/public/[bucket]/path/to/file
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
        .from('project_' + projectId)
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
