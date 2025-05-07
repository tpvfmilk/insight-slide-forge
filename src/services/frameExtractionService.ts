
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
): Promise<{ success: boolean; frames?: Array<{ timestamp: string, imageUrl: string }> }> => {
  try {
    toast.loading("Extracting video frames...", { id: "extract-frames" });
    
    const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/extract-frames', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        projectId,
        videoPath,
        timestamps
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extract frames");
    }
    
    const { frames } = await response.json();
    
    toast.success("Frame extraction completed!", { id: "extract-frames" });
    return { success: true, frames };
  } catch (error) {
    console.error("Error extracting frames:", error);
    toast.error(`Failed to extract frames: ${error.message}`, { id: "extract-frames" });
    return { success: false };
  }
};
