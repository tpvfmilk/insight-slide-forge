
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FrameExtractionResult {
  success: boolean;
  frames?: Array<{ timestamp: string, imageUrl: string }>; 
}

/**
 * Extract frames from a video at specific timestamps
 * @param projectId ID of the project
 * @param videoPath Path to the video file in storage
 * @param timestamps Array of timestamps in format "HH:MM:SS" to extract frames at
 * @returns Object containing success status and frame URLs if successful
 */
export const extractFramesFromVideo = async (
  projectId: string,
  videoPath: string,
  timestamps: string[]
): Promise<FrameExtractionResult> => {
  try {
    if (!timestamps || timestamps.length === 0) {
      console.warn("No timestamps provided for frame extraction");
      return { success: false };
    }
    
    // Deduplicate timestamps to avoid extracting the same frame multiple times
    const uniqueTimestamps = [...new Set(timestamps)];
    
    toast.loading("Extracting video frames...", { id: "extract-frames" });
    
    // Check for local development vs production
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalDev) {
      // In local development, generate placeholder frames for testing
      console.log("Local development detected, using placeholder frames");
      const placeholderFrames = uniqueTimestamps.map(timestamp => ({
        timestamp,
        imageUrl: `https://via.placeholder.com/640x360?text=Frame+at+${timestamp.replace(/:/g, '-')}`
      }));
      
      toast.success("Generated placeholder frames for local development", { id: "extract-frames" });
      return { success: true, frames: placeholderFrames };
    }
    
    console.log(`Extracting frames for project ${projectId} from ${videoPath} at timestamps:`, uniqueTimestamps);
    
    const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/extract-frames', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        projectId,
        videoPath,
        timestamps: uniqueTimestamps
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extract frames");
    }
    
    const { frames } = await response.json();
    
    console.log("Frames extracted successfully:", frames);
    toast.success("Frame extraction completed!", { id: "extract-frames" });
    return { success: true, frames };
  } catch (error) {
    console.error("Error extracting frames:", error);
    toast.error(`Failed to extract frames: ${error.message}`, { id: "extract-frames" });
    return { success: false };
  }
};

/**
 * Maps timestamps to their corresponding extracted frame images
 * @param extractedFrames Array of extracted frames with timestamps and imageUrls
 * @param slideTimestamps Array of timestamps associated with a specific slide
 * @returns Array of image URLs for the matching timestamps
 */
export const mapTimestampsToImages = (
  extractedFrames: Array<{ timestamp: string, imageUrl: string }> = [],
  slideTimestamps: string[] = []
): string[] => {
  if (!extractedFrames || extractedFrames.length === 0 || !slideTimestamps || slideTimestamps.length === 0) {
    return [];
  }
  
  // Create a map for quick lookup of timestamps to image URLs
  const frameMap = new Map<string, string>();
  extractedFrames.forEach(frame => {
    frameMap.set(frame.timestamp, frame.imageUrl);
  });
  
  // Map each timestamp to its corresponding image URL if available
  return slideTimestamps
    .map(timestamp => frameMap.get(timestamp))
    .filter(Boolean) as string[]; // Remove any undefined values
};
