/**
 * Utility functions for video operations
 */

// Format time display (seconds to MM:SS)
export const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds)) return "00:00";
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Get signed URL from Supabase storage with improved path handling and logging
export const getVideoSignedUrl = async (
  supabase: any, 
  videoPath: string, 
  expirySeconds: number = 7200
) => {
  if (!videoPath) {
    console.error("[VideoUtils] No video path provided");
    throw new Error("No video path provided");
  }
  
  console.log("[VideoUtils] Getting signed URL for video path:", videoPath);
  
  // Default bucket name - most videos are stored in this bucket
  const DEFAULT_BUCKET = 'video_uploads';
  
  // Initialize with default values
  let bucket = DEFAULT_BUCKET;
  let filePath = videoPath;
  
  try {
    // Handle paths with various formats
    if (videoPath.includes('/')) {
      const parts = videoPath.split('/');
      
      // Case 1: 'bucket/file.mp4' format
      if (parts.length === 2) {
        bucket = parts[0];
        filePath = parts[1];
        console.log(`[VideoUtils] Parsed as bucket/file: Bucket = ${bucket}, File = ${filePath}`);
      }
      // Case 2: 'bucket/folder/file.mp4' format
      else if (parts.length > 2) {
        // Common case: uploads/ID/file.mp4 - this should use video_uploads bucket
        if (parts[0] === 'uploads') {
          bucket = DEFAULT_BUCKET;
          filePath = videoPath; // Keep the full path as is
          console.log(`[VideoUtils] Uploads path detected: Using ${bucket} bucket with path ${filePath}`);
        }
        // Other cases, try with first part as bucket
        else {
          bucket = parts[0];
          filePath = parts.slice(1).join('/'); // Join remaining parts as path
          console.log(`[VideoUtils] Multi-part path: Bucket = ${bucket}, Path = ${filePath}`);
        }
      }
    } else {
      // Simple filename, use default bucket
      console.log(`[VideoUtils] Simple filename: Using ${bucket} bucket with file ${filePath}`);
    }
    
    // First attempt with parsed parameters
    console.log(`[VideoUtils] Attempting to get signed URL for bucket: ${bucket}, path: ${filePath}`);
    
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(filePath, expirySeconds);
      
    if (error) {
      console.error(`[VideoUtils] Error creating signed URL with bucket ${bucket}:`, error);
      
      // If the first attempt fails with a parsed path, try with default bucket
      if (bucket !== DEFAULT_BUCKET && filePath !== videoPath) {
        console.log(`[VideoUtils] Retrying with default bucket ${DEFAULT_BUCKET} and original path ${videoPath}`);
        
        const fallbackResult = await supabase
          .storage
          .from(DEFAULT_BUCKET)
          .createSignedUrl(videoPath, expirySeconds);
          
        if (fallbackResult.error) {
          console.error(`[VideoUtils] Fallback attempt also failed:`, fallbackResult.error);
          throw new Error("Couldn't create access link for video after multiple attempts");
        }
        
        console.log("[VideoUtils] Successfully created signed URL with fallback method");
        return fallbackResult.data.signedUrl;
      }
      
      throw new Error("Couldn't create access link for video: " + error.message);
    }
    
    if (!data?.signedUrl) {
      console.error("[VideoUtils] No signed URL in response");
      throw new Error("Couldn't create access link for video: Empty response");
    }
    
    console.log("[VideoUtils] Successfully created signed URL");
    return data.signedUrl;
  } catch (error) {
    console.error("[VideoUtils] Error in getVideoSignedUrl:", error);
    throw error;
  }
};

// Update project metadata with video duration
export const updateProjectDuration = async (
  supabase: any,
  projectId: string,
  videoDuration: number
) => {
  if (!projectId) {
    console.error("[VideoUtils] No project ID provided for duration update");
    return false;
  }
  
  console.log(`[VideoUtils] Updating duration for project ${projectId}: ${videoDuration.toFixed(2)}s`);
  
  try {
    // First get the current metadata
    const { data: projectData, error: fetchError } = await supabase
      .from('projects')
      .select('video_metadata')
      .eq('id', projectId)
      .single();
      
    if (fetchError) {
      console.error("[VideoUtils] Error fetching project metadata:", fetchError);
      throw new Error("Error fetching project metadata");
    }
    
    // Initialize metadata as an empty object if it doesn't exist
    const currentMetadata = projectData?.video_metadata || {};
    
    // Update the duration in the metadata
    const updatedMetadata = {
      ...((currentMetadata || {}) as object),
      duration: videoDuration
    };
    
    // Save the updated metadata back to the database
    const { error: updateError } = await supabase
      .from('projects')
      .update({ video_metadata: updatedMetadata })
      .eq('id', projectId);
      
    if (updateError) {
      console.error("[VideoUtils] Error updating project metadata:", updateError);
      throw new Error("Error updating project metadata");
    }
    
    console.log(`[VideoUtils] Successfully updated duration for project ${projectId}`);
    return true;
  } catch (error) {
    console.error("[VideoUtils] Error in updateProjectDuration:", error);
    return false;
  }
};
