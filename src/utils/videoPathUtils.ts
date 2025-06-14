
import { supabase } from "@/integrations/supabase/client";

/**
 * Parses a storage path into bucket name and file path
 * @param fullPath The full storage path
 * @returns Object containing bucketName and filePath
 */
export const parseStoragePath = (fullPath: string | null): { bucketName: string, filePath: string } => {
  if (!fullPath) {
    return { bucketName: 'video_uploads', filePath: '' };
  }

  // Remove any leading slashes
  const cleanPath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

  // Check bucket prefixes - explicit mapping to ensure paths are correctly routed
  if (cleanPath.startsWith('video_uploads/')) {
    return { 
      bucketName: 'video_uploads', 
      filePath: cleanPath.replace('video_uploads/', '')
    };
  }
  
  if (cleanPath.startsWith('uploads/')) {
    return { 
      bucketName: 'video_uploads', 
      filePath: cleanPath
    };
  }
  
  if (cleanPath.startsWith('chunks/')) {
    return {
      bucketName: 'chunks',
      filePath: cleanPath.replace('chunks/', '')
    };
  }
  
  if (cleanPath.startsWith('audio_chunks/')) {
    return {
      bucketName: 'audio_chunks',
      filePath: cleanPath.replace('audio_chunks/', '')
    };
  }
  
  if (cleanPath.startsWith('audio_extracts/')) {
    return {
      bucketName: 'audio_extracts',
      filePath: cleanPath.replace('audio_extracts/', '')
    };
  }
  
  if (cleanPath.startsWith('slide_stills/')) {
    return {
      bucketName: 'slide_stills',
      filePath: cleanPath.replace('slide_stills/', '')
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
 * Checks if a file exists in Supabase storage
 * @param fullPath The full storage path
 * @returns Promise resolving to a boolean indicating if the file exists
 */
export const checkFileExists = async (fullPath: string | null): Promise<boolean> => {
  if (!fullPath) return false;
  
  try {
    const { bucketName, filePath } = parseStoragePath(fullPath);
    
    // Get the directory path and filename
    const pathParts = filePath.split('/');
    const fileName = pathParts.pop() || '';
    const directoryPath = pathParts.join('/');
    
    // List files in the directory to check if our file exists
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .list(directoryPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });
      
    if (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
    
    // Check if our file is in the list
    return data?.some(item => item.name === fileName) || false;
  } catch (error) {
    console.error("Error in checkFileExists:", error);
    return false;
  }
};

/**
 * Creates a signed URL for a video file
 * @param fullPath The full storage path
 * @param expiresIn Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Promise resolving to the signed URL or null if error
 */
export const createSignedVideoUrl = async (
  fullPath: string | null, 
  expiresIn: number = 3600
): Promise<string | null> => {
  if (!fullPath) return null;
  
  try {
    const { bucketName, filePath } = parseStoragePath(fullPath);
    
    // Create a signed URL with the specified expiry time
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error("Error in createSignedVideoUrl:", error);
    return null;
  }
};

/**
 * Fixes chunked video path references to ensure they're formatted correctly
 * @param videoPath The video path that might be a chunk reference
 * @returns Properly formatted path
 */
export const ensureCorrectChunkPath = (videoPath: string | null): string | null => {
  if (!videoPath) return null;
  
  // Remove any leading slashes
  const cleanPath = videoPath.startsWith('/') ? videoPath.substring(1) : videoPath;
  
  // Fix incorrect chunk paths
  if (cleanPath.includes('_chunk_') && !cleanPath.startsWith('chunks/')) {
    return `chunks/${cleanPath}`;
  }
  
  // Fix incorrect audio chunk paths
  if (cleanPath.includes('_audio_chunk_') && !cleanPath.startsWith('audio_chunks/')) {
    return `audio_chunks/${cleanPath}`;
  }
  
  return videoPath;
};

/**
 * Gets the correct bucket for a specific file type
 * @param fileType The MIME type of the file
 * @returns The appropriate bucket name for the file type
 */
export const getBucketForFileType = (fileType: string): string => {
  if (fileType.startsWith('video/')) {
    return 'video_uploads';
  }
  
  if (fileType.startsWith('audio/')) {
    return 'audio_extracts';
  }
  
  if (fileType.startsWith('image/')) {
    return 'slide_stills';
  }
  
  return 'video_uploads'; // Default bucket
};

/**
 * Creates a path for a file in the appropriate bucket
 * @param projectId The project ID
 * @param fileName The file name
 * @param fileType The MIME type of the file
 * @returns The full path for the file
 */
export const createPathForFile = (projectId: string, fileName: string, fileType: string): string => {
  const bucketName = getBucketForFileType(fileType);
  return `${projectId}/${Date.now()}_${fileName}`;
};
