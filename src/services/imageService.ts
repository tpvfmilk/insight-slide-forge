
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { initializeStorage } from "./storageService";
import { toast } from "sonner";

/**
 * Uploads an image file to Supabase storage for slides
 * @param file Image file to be uploaded
 * @returns Object containing file path and URL
 */
export const uploadSlideImage = async (file: File | Blob): Promise<{ path: string; url: string } | null> => {
  try {
    // Ensure storage buckets are initialized before uploading
    const initialized = await initializeStorage();
    if (!initialized) {
      toast.error("Failed to initialize storage. Please check your connection and try again.");
    }
    
    // Generate a unique file name
    const fileName = `${uuidv4()}.jpg`;
    const filePath = `slides/${fileName}`;

    // Check if slide_stills bucket exists
    try {
      const { data: bucket, error: bucketError } = await supabase
        .storage
        .getBucket('slide_stills');
        
      if (bucketError) {
        console.error('Error checking slide_stills bucket:', bucketError);
        // We'll continue anyway since initializeStorage should have created it
      }
    } catch (bucketError) {
      console.error('Exception checking slide_stills bucket:', bucketError);
      // Continue with upload attempt
    }

    // Upload file to Supabase storage
    const { data, error } = await supabase
      .storage
      .from('slide_stills')
      .upload(filePath, file, {
        contentType: 'image/jpeg'
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }

    // Get the public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('slide_stills')
      .getPublicUrl(data.path);

    return {
      path: data.path,
      url: publicUrl
    };
  } catch (error) {
    console.error('Error in uploadSlideImage:', error);
    toast.error(`Failed to upload image: ${error.message}`);
    return null;
  }
};

// Define a type for slide to ensure type safety
type Slide = {
  transcriptTimestamps?: string[];
  timestamp?: string;
  imageUrls?: string[];
  imageUrl?: string;
  [key: string]: any;
};

/**
 * Checks if project slides have timestamps but no images
 * @param slides Array of slides to check
 * @returns Boolean indicating if frames need extraction
 */
export const slidesNeedFrameExtraction = (slides: any[] | null): boolean => {
  if (!slides || !Array.isArray(slides) || slides.length === 0) {
    return false;
  }
  
  // Check if any slides have timestamps but no images
  const slidesWithTimestamps = slides.filter(slideJson => {
    if (!slideJson) return false;
    
    // Cast to our slide type to access properties safely
    const slide = slideJson as Slide;
    
    // Check if slide has timestamps (either as array or single timestamp)
    const hasTimestamps = 
      (slide.transcriptTimestamps && Array.isArray(slide.transcriptTimestamps) && slide.transcriptTimestamps.length > 0) ||
      (slide.timestamp && typeof slide.timestamp === 'string');
    
    // Check if slide has images (either as array or single image)
    const hasImages = 
      (slide.imageUrls && Array.isArray(slide.imageUrls) && slide.imageUrls.length > 0) ||
      (slide.imageUrl && typeof slide.imageUrl === 'string');
    
    // We're interested in slides that have timestamps but no images
    return hasTimestamps && !hasImages;
  });
  
  return slidesWithTimestamps.length > 0;
};

/**
 * Uploads a frame extracted from a video
 * @param frame Blob containing the frame image
 * @param timestamp Timestamp associated with the frame
 * @returns Object containing the path and URL of the uploaded image
 */
export const uploadFrameImage = async (
  frame: Blob,
  timestamp: string
): Promise<{ path: string; url: string } | null> => {
  try {
    // Create a file name based on the timestamp
    const sanitizedTimestamp = timestamp.replace(/:/g, '-');
    const fileName = `frame-${sanitizedTimestamp}-${uuidv4().slice(0, 8)}.jpg`;
    const filePath = `frames/${fileName}`;
    
    // Upload the frame to storage
    const { data, error } = await supabase
      .storage
      .from('slide_stills')
      .upload(filePath, frame, {
        contentType: 'image/jpeg'
      });
      
    if (error) {
      console.error('Error uploading frame:', error);
      throw error;
    }
    
    // Get the public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('slide_stills')
      .getPublicUrl(data.path);
      
    return {
      path: data.path,
      url: publicUrl
    };
  } catch (error) {
    console.error('Error in uploadFrameImage:', error);
    return null;
  }
};
