
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { initializeStorage } from "./storageService";
import { Json } from "@/integrations/supabase/types";

interface ClientFrameExtractionResult {
  success: boolean;
  frames?: Array<{ timestamp: string, imageUrl: string }>;
  error?: string;
}

// Define a type to handle slide objects from the database
interface Slide {
  id: string;
  title?: string;
  content?: string;
  timestamp?: string;
  imageUrl?: string;
  transcriptTimestamps?: string[];
  imageUrls?: string[];
  [key: string]: any; // Allow for additional properties
}

/**
 * Extract frames from a video at specific timestamps using client-side HTML5 Video API
 * @param projectId ID of the project
 * @param videoPath Path to the video file in storage
 * @param timestamps Array of timestamps in format "HH:MM:SS" to extract frames at
 * @param onComplete Optional callback for when frames are extracted
 */
export const clientExtractFramesFromVideo = async (
  projectId: string,
  videoPath: string,
  timestamps: string[],
  onComplete?: (frames: Array<{ timestamp: string, imageUrl: string }>) => void
): Promise<ClientFrameExtractionResult> => {
  try {
    if (!timestamps || timestamps.length === 0) {
      console.warn("No timestamps provided for frame extraction");
      return { success: false, error: "No timestamps provided" };
    }
    
    // Deduplicate timestamps to avoid extracting the same frame multiple times
    const uniqueTimestamps = [...new Set(timestamps)];
    
    console.log(`Preparing to extract ${uniqueTimestamps.length} frames for project ${projectId} from video: ${videoPath}`);
    
    // Ensure storage buckets are initialized before proceeding
    await initializeStorage();
    
    // Generate a signed URL for the video with an expiration of 1 hour and CORS settings
    // REMOVED the transform property to avoid any format compatibility issues
    const { data, error } = await supabase.storage.from('video_uploads')
      .createSignedUrl(videoPath, 3600, {
        download: false // We need to stream, not download
        // Transformation options removed to fix format errors
      });
      
    if (error || !data?.signedUrl) {
      console.error("Error creating signed URL:", error);
      toast.error("Could not access the video file. Please check permissions.");
      return { success: false, error: error?.message || "Failed to get secure video URL" };
    }
    
    const videoUrl = data.signedUrl;
    console.log("Generated secure video URL for extraction without transformations");
    
    return {
      success: true,
      frames: [] // The actual frames will be extracted and uploaded by the FrameExtractionModal component
    };
    
  } catch (error) {
    console.error("Error in client frame extraction:", error);
    toast.error(`Failed to prepare frame extraction: ${(error as Error).message}`);
    return { success: false, error: (error as Error).message };
  }
};

/**
 * Update slides with extracted frame images
 * @param projectId ID of the project
 * @param extractedFrames Array of extracted frames with timestamps and imageUrls
 */
export const updateSlidesWithExtractedFrames = async (
  projectId: string,
  extractedFrames: Array<{ timestamp: string, imageUrl: string }>
): Promise<boolean> => {
  try {
    if (!extractedFrames || extractedFrames.length === 0) {
      console.warn("No extracted frames provided for updating slides");
      return false;
    }
    
    toast.loading("Updating slides with extracted frames...", { id: "update-slides" });
    
    // Fetch the project to get the current slides
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('slides')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project || !project.slides) {
      console.error("Error fetching project slides:", projectError);
      toast.error("Failed to fetch project slides", { id: "update-slides" });
      return false;
    }
    
    // Create a map for quick lookup of timestamps to image URLs
    const frameMap = new Map<string, string>();
    extractedFrames.forEach(frame => {
      frameMap.set(frame.timestamp, frame.imageUrl);
    });
    
    // Type guard function to check if an item is a Slide object
    const isSlideObject = (item: Json): item is Slide => {
      return item !== null && typeof item === 'object' && !Array.isArray(item);
    };
    
    // Update each slide with matching timestamps
    const updatedSlides = Array.isArray(project.slides) ? project.slides.map(item => {
      if (!isSlideObject(item)) return item;
      
      // Create a copy of the slide to update
      const slide = item as Slide;
      const updatedSlide: Slide = { ...slide };
      
      // Handle single timestamp
      if (typeof slide.timestamp === 'string' && frameMap.has(slide.timestamp)) {
        updatedSlide.imageUrl = frameMap.get(slide.timestamp);
        console.log(`Updated slide ${slide.id} with image for timestamp ${slide.timestamp}`);
      }
      
      // Handle multiple timestamps
      if (Array.isArray(slide.transcriptTimestamps)) {
        const imageUrls: string[] = [];
        
        slide.transcriptTimestamps.forEach(timestamp => {
          if (typeof timestamp === 'string') {
            const imageUrl = frameMap.get(timestamp);
            if (imageUrl) {
              imageUrls.push(imageUrl);
            }
          }
        });
        
        if (imageUrls.length > 0) {
          updatedSlide.imageUrls = imageUrls;
          console.log(`Updated slide ${slide.id} with ${imageUrls.length} images for multiple timestamps`);
        }
      }
      
      return updatedSlide;
    }) : [];
    
    // Update the project with the updated slides
    const { error: updateError } = await supabase
      .from('projects')
      .update({ slides: updatedSlides })
      .eq('id', projectId);
    
    if (updateError) {
      console.error("Error updating project slides:", updateError);
      toast.error("Failed to update slides", { id: "update-slides" });
      return false;
    }
    
    toast.success("Slides updated with extracted frames", { id: "update-slides" });
    return true;
  } catch (error) {
    console.error("Error updating slides with extracted frames:", error);
    toast.error(`Failed to update slides: ${(error as Error).message}`, { id: "update-slides" });
    return false;
  }
};
