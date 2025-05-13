
/**
 * Utility functions for video operations
 */

// Format time display (seconds to MM:SS)
export const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Get signed URL from Supabase storage with improved path handling
export const getVideoSignedUrl = async (
  supabase: any, 
  videoPath: string, 
  expirySeconds: number = 7200
) => {
  if (!videoPath) {
    throw new Error("No video path provided");
  }
  
  console.log("Getting signed URL for video path:", videoPath);
  
  // Default bucket and path
  let bucket = 'video_uploads';
  let filePath = videoPath;
  
  // Handle paths with bucket/filename format
  if (videoPath.includes('/')) {
    const parts = videoPath.split('/');
    
    // If path has format 'bucket/file.mp4'
    if (parts.length === 2) {
      bucket = parts[0];
      filePath = parts[1];
    } 
    // If path has deeper nesting like 'bucket/folder/file.mp4'
    else if (parts.length > 2) {
      bucket = parts[0];
      // Join all remaining parts as the file path
      filePath = parts.slice(1).join('/');
    }
  }
  
  console.log(`Parsed video path - Bucket: ${bucket}, File path: ${filePath}`);
  
  // Get a fresh signed URL with specified expiry
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(filePath, expirySeconds);
    
  if (error) {
    console.error("Error creating signed URL:", error);
    throw new Error("Couldn't create access link for video: " + error.message);
  }
  
  if (!data?.signedUrl) {
    console.error("No signed URL in response");
    throw new Error("Couldn't create access link for video: Empty response");
  }
  
  console.log("Successfully created signed URL");
  
  return data.signedUrl;
};

// Update project metadata with video duration
export const updateProjectDuration = async (
  supabase: any,
  projectId: string,
  videoDuration: number
) => {
  // First get the current metadata
  const { data: projectData, error: fetchError } = await supabase
    .from('projects')
    .select('video_metadata')
    .eq('id', projectId)
    .single();
    
  if (fetchError) {
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
    throw new Error("Error updating project metadata");
  }
  
  return true;
};
