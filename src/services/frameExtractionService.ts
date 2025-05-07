
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FrameExtractionResult {
  success: boolean;
  frames?: Array<{ timestamp: string, imageUrl: string }>; 
  error?: string;
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
      return { success: false, error: "No timestamps provided" };
    }
    
    // Deduplicate timestamps to avoid extracting the same frame multiple times
    const uniqueTimestamps = [...new Set(timestamps)];
    
    toast.loading("Extracting video frames...", { id: "extract-frames" });
    console.log(`Extracting ${uniqueTimestamps.length} frames for project ${projectId} from video: ${videoPath}`);
    
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
    
    // Call the edge function to extract frames
    console.log(`Calling extract-frames edge function for project ${projectId} with ${uniqueTimestamps.length} timestamps`);
    
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
      let errorMessage = "Failed to extract frames";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        console.error("Extract frames error response:", errorData);
      } catch (e) {
        // If we can't parse the error, use the status text
        errorMessage = response.statusText || errorMessage;
      }
      
      console.error(`Extract frames failed with status: ${response.status} ${response.statusText}`);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    const { frames, success } = data;
    
    if (!success || !frames || !Array.isArray(frames)) {
      console.error("Extract frames returned unexpected response:", data);
      throw new Error("Invalid response from frame extraction service");
    }
    
    console.log(`Frames extracted successfully: ${frames.length} frames`);
    
    // Validate that each frame has a timestamp and imageUrl
    const validFrames = frames.filter(frame => frame.timestamp && frame.imageUrl);
    
    if (validFrames.length === 0 && frames.length > 0) {
      console.error("No valid frames were returned");
      throw new Error("No valid frames were extracted");
    }
    
    if (validFrames.length < frames.length) {
      console.warn(`Some frames were invalid: ${frames.length - validFrames.length} out of ${frames.length}`);
    }
    
    toast.success(`Successfully extracted ${validFrames.length} frames`, { id: "extract-frames" });
    return { success: true, frames: validFrames };
  } catch (error) {
    console.error("Error extracting frames:", error);
    toast.error(`Failed to extract frames: ${error.message}`, { id: "extract-frames" });
    return { success: false, error: error.message };
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
  
  console.log(`Mapping ${extractedFrames.length} frames to ${slideTimestamps.length} timestamps`);
  
  // Create a map for quick lookup of timestamps to image URLs
  const frameMap = new Map<string, string>();
  extractedFrames.forEach(frame => {
    if (frame && frame.timestamp && frame.imageUrl) {
      frameMap.set(frame.timestamp, frame.imageUrl);
    }
  });
  
  // Map each timestamp to its corresponding image URL if available
  const imageUrls = slideTimestamps
    .map(timestamp => {
      const url = frameMap.get(timestamp);
      if (!url) {
        console.warn(`No image found for timestamp: ${timestamp}`);
      }
      return url;
    })
    .filter(Boolean) as string[];
    
  console.log(`Mapped ${imageUrls.length} image URLs for ${slideTimestamps.length} timestamps`);
  
  return imageUrls;
};
