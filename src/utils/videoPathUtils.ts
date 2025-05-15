
/**
 * Helper function to parse a storage path into bucket name and file path
 * @param fullPath The full path to the file
 * @returns An object containing the bucket name and file path 
 */
export const parseStoragePath = (
  fullPath: string
): { bucketName: string; filePath: string } => {
  if (!fullPath) {
    return { bucketName: 'video_uploads', filePath: '' };
  }

  // Remove any leading slashes
  const cleanPath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

  // Check if path starts with a specific bucket prefix
  const knownBuckets = ['video_uploads', 'slide_stills'];
  for (const bucket of knownBuckets) {
    if (cleanPath.startsWith(`${bucket}/`)) {
      return { 
        bucketName: bucket, 
        filePath: cleanPath.replace(`${bucket}/`, '')
      };
    }
  }
  
  // Check if path is for a chunked video
  if (cleanPath.includes('/chunks/') || cleanPath.includes('_chunk_')) {
    console.log("Detected chunked video path:", cleanPath);
    // Use video_uploads bucket for chunked videos
    return { 
      bucketName: 'video_uploads', 
      filePath: cleanPath
    };
  }
  
  // Check if path is just 'uploads/...'
  if (cleanPath.startsWith('uploads/')) {
    return { 
      bucketName: 'video_uploads', 
      filePath: cleanPath
    };
  }

  // Check if path has a bucket prefix (bucket/path format)
  if (cleanPath.includes('/')) {
    const parts = cleanPath.split('/');
    // If first part doesn't have a dot (likely not a filename), treat as bucket
    if (parts.length > 1 && !parts[0].includes('.')) {
      return { 
        bucketName: parts[0],
        filePath: parts.slice(1).join('/')
      };
    }
  }
  
  // Default to video_uploads bucket
  return { 
    bucketName: 'video_uploads', 
    filePath: cleanPath
  };
};

/**
 * Creates a signed URL for a video file stored in Supabase Storage
 * @param videoPath Path to the video file
 * @param expirySeconds Number of seconds until the URL expires (default: 3600)
 * @returns A promise that resolves to the signed URL or null if it fails
 */
export const createSignedVideoUrl = async (
  videoPath: string,
  expirySeconds: number = 3600
): Promise<string | null> => {
  try {
    if (!videoPath) {
      console.error("No video path provided for signed URL creation");
      return null;
    }
    
    // Import supabase client
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Parse the path to get bucket and file path
    const { bucketName, filePath } = parseStoragePath(videoPath);
    
    if (!filePath) {
      console.error("Invalid file path for signed URL creation");
      return null;
    }
    
    console.log(`Creating signed URL for ${bucketName}/${filePath} with ${expirySeconds}s expiry`);
    
    // Create a signed URL with the specified expiration
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expirySeconds);
    
    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error("Failed to create signed video URL:", error);
    return null;
  }
};

