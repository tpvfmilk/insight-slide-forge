
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { mergeAndSaveFrames } from "@/utils/frameUtils";

/**
 * Upload a frame to Supabase storage
 * @param frame The blob data for the frame
 * @param timestamp Timestamp of the frame
 * @param projectId ID of the project
 * @returns URL of the uploaded frame or null if upload failed
 */
export const uploadFrameToStorage = async (
  frame: Blob, 
  timestamp: string, 
  projectId: string
): Promise<string | null> => {
  try {
    if (!projectId) {
      throw new Error("Project ID is required to upload frames");
    }
    
    // Create a File from the Blob
    const fileName = `frame-${timestamp.replace(/:/g, "-")}-${Date.now()}.jpg`;
    const file = new File([frame], fileName, {
      type: 'image/jpeg'
    });
    
    // Upload to Supabase Storage - ensure proper path and bucket
    const filePath = `${projectId}/${timestamp.replace(/:/g, '_')}-${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('slide_stills')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
      
    if (uploadError || !uploadData?.path) {
      console.error("Error uploading frame:", uploadError);
      return null;
    }
    
    // Get public URL - CRUCIAL for persistence
    const { data: urlData } = supabase
      .storage
      .from('slide_stills')
      .getPublicUrl(uploadData.path);
      
    console.log(`Frame uploaded successfully, got permanent URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error("Error in uploadFrameToStorage:", error);
    return null;
  }
};

/**
 * Store a new frame in the project's frame library
 * @param frame The frame to store
 * @param projectId ID of the project
 * @param existingFrames Optional array of existing frames to merge with
 * @returns True if the operation was successful
 */
export const storeFrameInLibrary = async (
  frame: ExtractedFrame,
  projectId: string,
  existingFrames: ExtractedFrame[] = []
): Promise<ExtractedFrame[]> => {
  try {
    // Call the utility function to merge and save the frame
    const combinedFrames = await mergeAndSaveFrames(projectId, [frame], existingFrames);
    
    if (!combinedFrames) {
      throw new Error("Failed to merge frames");
    }
    
    return combinedFrames;
  } catch (error) {
    console.error("Error in storeFrameInLibrary:", error);
    toast.error("Failed to store frame in library");
    return existingFrames;
  }
};

/**
 * Load all frames from a project's frame library
 * @param projectId ID of the project
 * @returns Array of frames or empty array if none found
 */
export const loadFramesFromProject = async (projectId: string): Promise<ExtractedFrame[]> => {
  if (!projectId) return [];
  
  try {
    console.log("Loading frames from project database...");
    const { data: project } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .single();
    
    if (project && project.extracted_frames && Array.isArray(project.extracted_frames)) {
      // Filter out any frames without valid URLs
      const frames = (project.extracted_frames as unknown as ExtractedFrame[])
        .filter(frame => frame && frame.imageUrl && !frame.imageUrl.startsWith('blob:'))
        .map(frame => ({
          ...frame,
          imageUrl: frame.imageUrl,
          timestamp: frame.timestamp,
          id: frame.id || `frame-${frame.timestamp?.replace(/:/g, "-")}-${Date.now()}` // Generate a unique ID if not present
        }));
      
      console.log(`Loaded ${frames.length} frames from project database`);
      return frames;
    }
    return [];
  } catch (error) {
    console.error("Error loading frames from project:", error);
    return [];
  }
};

/**
 * Synchronize frames with the database
 * @param frames Frames to synchronize
 * @param projectId ID of the project
 */
export const syncFramesWithDatabase = async (frames: ExtractedFrame[], projectId: string): Promise<void> => {
  if (!projectId) return;
  
  try {
    console.log(`Syncing ${frames.length} frames with database...`);
    
    // Store frames in the project's extracted_frames field in the database
    const { error } = await supabase
      .from('projects')
      .update({ 
        extracted_frames: frames,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    if (error) {
      console.error("Error syncing frames with database:", error);
      throw error;
    }
    
    console.log(`Successfully synchronized ${frames.length} frames with database`);
  } catch (error) {
    console.error("Error in syncFramesWithDatabase:", error);
    toast.error("Failed to synchronize frames with database");
  }
};
