// This file is responsible for client-side frame extraction from videos

import { supabase } from "@/integrations/supabase/client";
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";
import { toast } from "sonner";

interface ExtractedFrame {
  timestamp: string;
  imageUrl: string;
  isPlaceholder?: boolean;
}

interface ClientFrameExtractionResult {
  success: boolean;
  frames?: ExtractedFrame[];
  error?: string;
}

/**
 * Uploads a blob to Supabase storage.
 * @param bucketName The name of the storage bucket.
 * @param filePath The path to store the file in the bucket.
 * @param file The blob to upload.
 * @returns The public URL of the uploaded file, or null if the upload fails.
 */
async function uploadToStorage(
  bucketName: string,
  filePath: string,
  file: Blob
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
    });
    
    if (error) {
      console.error("Error uploading to storage:", error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error("Error in uploadToStorage:", error);
    return null;
  }
}

/**
 * Extracts frames from a video at specific timestamps and uploads them to Supabase storage.
 * @param projectId The ID of the project.
 * @param videoPath The URL of the video.
 * @param timestamps An array of timestamps to extract frames from.
 * @returns An array of objects containing the timestamp and the URL of the extracted frame.
 */
export async function clientExtractFramesFromVideo(
  projectId: string,
  videoPath: string,
  timestamps: string[]
): Promise<{
  success: boolean;
  frames?: Array<{
    timestamp: string;
    imageUrl: string;
    isPlaceholder?: boolean;
  }>;
  error?: string;
}> {
  try {
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    if (!videoPath) {
      throw new Error("Video URL is required");
    }

    if (!timestamps || timestamps.length === 0) {
      return { success: true, frames: [] };
    }

    // Create a unique identifier for the frames based on the projectId and timestamps
    const frameId = `${projectId}-${timestamps.join('-')}`;
    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("Storage bucket name is not defined in environment variables.");
    }

    // Extract frames from the video
    const frames = await extractFramesFromVideoUrl(videoPath, timestamps);

    // Upload each frame to Supabase storage
    const uploadPromises = frames.map(async (frame) => {
      const timestamp = frame.timestamp;
      const blob = frame.frame;
      const filePath = `projects/${projectId}/frames/${frameId}/${timestamp.replace(/:/g, "-")}.jpg`;

      // Upload the blob to Supabase storage
      const imageUrl = await uploadToStorage(bucketName, filePath, blob);
      
      if (!imageUrl) {
        console.error(`Failed to upload frame for timestamp ${timestamp}`);
        return null;
      }

      return { timestamp, imageUrl };
    });

    // Wait for all uploads to complete
    const uploadedFrames = (await Promise.all(uploadPromises)).filter(Boolean) as Array<{ timestamp: string; imageUrl: string }>;

    return {
      success: true,
      frames: uploadedFrames.map(frame => ({
        timestamp: frame.timestamp,
        imageUrl: frame.imageUrl,
      })),
    };
  } catch (error: any) {
    console.error("Error extracting frames:", error);
    return { success: false, error: error.message || "Failed to extract frames" };
  }
}

/**
 * Uploads a file using XMLHttpRequest and returns a promise.
 * @param url The URL to upload the file to.
 * @param file The file to upload.
 * @param onProgress Callback function to track upload progress.
 * @returns A promise that resolves when the upload is complete, or rejects if it fails.
 */
function uploadFileWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = function(event) {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };

    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(`Upload failed with status ${xhr.status}`);
      }
    };

    // Fix the TypeScript error in the event handler
    xhr.onerror = function(e) {
      // Fixed TypeScript error by checking event type
      if (typeof e === 'string') {
        console.error('XHR error (string):', e);
        reject(`Upload error: ${e}`);
        return;
      }

      console.error('XHR error:', e);
      reject('XHR upload failed');
    };

    xhr.send(file);
  });
}

/**
 * Generates placeholder images for the slides that are missing images.
 * @param projectId The ID of the project.
 * @param slides The slides to generate placeholder images for.
 * @returns An array of objects containing the timestamp and the URL of the extracted frame.
 */
export async function generatePlaceholderFrames(
  projectId: string,
  slides: Array<{ timestamp?: string }>
): Promise<ClientFrameExtractionResult> {
  try {
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    if (!slides || slides.length === 0) {
      return { success: true, frames: [] };
    }

    // Filter slides that have a timestamp but no image URL
    const slidesWithoutImage = slides.filter(slide => slide.timestamp);

    if (slidesWithoutImage.length === 0) {
      return { success: true, frames: [] };
    }

    // Create placeholder images for each slide
    const placeholderFrames = slidesWithoutImage.map(slide => ({
      timestamp: slide.timestamp as string,
      imageUrl: `/placeholder.svg`, // Use local placeholder image
      isPlaceholder: true,
    }));

    return {
      success: true,
      frames: placeholderFrames.map(frame => ({
        timestamp: frame.timestamp,
        imageUrl: frame.imageUrl,
        isPlaceholder: true,
      })),
    };
  } catch (error: any) {
    console.error("Error generating placeholder frames:", error);
    return { success: false, error: error.message || "Failed to generate placeholder frames" };
  }
}

/**
 * Updates slides with extracted frames.
 * @param projectId The ID of the project.
 * @param frames The extracted frames.
 */
export async function updateSlidesWithExtractedFrames(projectId: string, frames: Array<{ timestamp: string, imageUrl: string }>): Promise<boolean> {
  try {
    if (!projectId) {
      throw new Error("Project ID is required");
    }

    if (!frames || frames.length === 0) {
      console.warn("No frames to update");
      return true;
    }

    // Fetch the project from Supabase
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('slides')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch project: ${fetchError.message}`);
    }

    if (!project || !project.slides) {
      throw new Error("Project not found or slides are missing");
    }

    // Ensure slides is an array
    let slides = Array.isArray(project.slides) ? project.slides : [];

    // Update the slides with the extracted frame URLs
    const updatedSlides = slides.map((slide: any) => {
      if (typeof slide !== 'object' || slide === null) {
        return slide; // Skip if the slide is not an object
      }

      const matchingFrame = frames.find(frame => frame.timestamp === slide.timestamp);
      if (matchingFrame) {
        return { ...slide, imageUrl: matchingFrame.imageUrl };
      }

      return slide;
    });

    // Update the project in Supabase
    const { error: updateError } = await supabase
      .from('projects')
      .update({ slides: updatedSlides })
      .eq('id', projectId);

    if (updateError) {
      throw new Error(`Failed to update project: ${updateError.message}`);
    }

    toast.success("Slides updated with extracted frames");
    return true;
  } catch (error: any) {
    console.error("Error updating slides with extracted frames:", error);
    toast.error(`Failed to update slides: ${error.message}`);
    return false;
  }
}
