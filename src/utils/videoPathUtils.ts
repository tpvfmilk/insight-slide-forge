
import { supabase } from "@/integrations/supabase/client";

/**
 * Parse a storage path to determine bucket name and file path
 * @param fullPath The full path including potential bucket name
 */
export function parseStoragePath(fullPath: string): { bucketName: string; filePath: string } {
  if (!fullPath) {
    return { bucketName: 'video_uploads', filePath: fullPath };
  }

  // Remove any leading slashes
  const cleanPath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

  // Check if path starts with 'video_uploads/' prefix
  if (cleanPath.startsWith('video_uploads/')) {
    return { 
      bucketName: 'video_uploads', 
      filePath: cleanPath.replace('video_uploads/', '')
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
}

/**
 * Creates a signed URL for a video path
 * @param videoPath Video path (can include bucket name)
 * @param expirySeconds Optional expiry in seconds (default: 3600 / 1 hour)
 */
export async function createSignedVideoUrl(
  videoPath: string, 
  expirySeconds: number = 3600
): Promise<string | null> {
  if (!videoPath) {
    return null;
  }
  
  try {
    // Parse the path to get bucket and file path
    const { bucketName, filePath } = parseStoragePath(videoPath);
    
    console.log(`Creating signed URL for ${bucketName}/${filePath}`);
    
    // Create a signed URL with an expiration
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expirySeconds);
    
    if (error) {
      console.error("Error creating signed URL:", error);
      
      // Try to get a public URL as fallback
      const { data: publicUrlData } = await supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      
      if (publicUrlData?.publicUrl) {
        console.log("Using public URL as fallback");
        return publicUrlData.publicUrl;
      }
      
      return null;
    }
    
    return data.signedUrl;
  } catch (err) {
    console.error("Failed to create signed URL:", err);
    return null;
  }
}

/**
 * Gets the correct path to a chunked video
 * @param chunkPath The path to the chunk
 * @param projectId Optional project ID for fallback
 */
export function getChunkVideoPath(
  chunkPath: string,
  projectId?: string
): string {
  // If it's already a full path, return as is
  if (chunkPath.includes('/')) {
    return chunkPath;
  }
  
  // If it's a chunk name, add the video_uploads prefix
  return `video_uploads/${chunkPath}`;
}

/**
 * Checks if a path is for a chunked video
 */
export function isChunkedVideoPath(path: string): boolean {
  return path.includes('/chunks/') || path.includes('_chunk_');
}
