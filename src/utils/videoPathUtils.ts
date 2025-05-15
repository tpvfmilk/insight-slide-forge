
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
