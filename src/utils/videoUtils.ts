
/**
 * Utility functions for video operations
 */

// Format time display (seconds to MM:SS)
export const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Get signed URL from Supabase storage
export const getVideoSignedUrl = async (
  supabase: any, 
  videoPath: string, 
  expirySeconds: number = 7200
) => {
  if (!videoPath) {
    throw new Error("No video path provided");
  }
  
  // Extract bucket and file path
  let bucket = 'video_uploads';
  let filePath = videoPath;
  
  // If path includes '/', extract the actual file path without bucket name
  if (videoPath.includes('/')) {
    const pathParts = videoPath.split('/');
    if (pathParts.length > 1) {
      filePath = pathParts.pop() || '';
      bucket = pathParts.join('/');
    }
  }
  
  // Get a fresh signed URL with specified expiry
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(filePath, expirySeconds);
    
  if (error || !data?.signedUrl) {
    throw new Error("Couldn't create access link for video");
  }
  
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
