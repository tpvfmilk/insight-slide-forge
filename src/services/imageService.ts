
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

/**
 * Uploads an image for slide content
 * @param file Image file to upload
 * @returns Object with upload path and public URL
 */
export const uploadSlideImage = async (file: File): Promise<{ path: string, url: string } | null> => {
  try {
    // Generate a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `slide_${fileName}`;

    // Upload to the slide_stills bucket
    const { data, error } = await supabase
      .storage
      .from('slide_stills')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('Error uploading slide image:', error);
      throw error;
    }

    // Get the public URL
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
    toast.error(`Failed to upload image: ${(error as Error).message}`);
    return null;
  }
};

/**
 * Checks if slides need frame extraction (have timestamps but no images)
 * @param slides Array of slide objects
 * @returns Boolean indicating if at least one slide needs frame extraction
 */
export const slidesNeedFrameExtraction = (slides: any[]): boolean => {
  if (!Array.isArray(slides) || slides.length === 0) {
    return false;
  }

  return slides.some(slide => {
    if (!slide) return false;
    
    // Check if a slide has a timestamp but no imageUrl
    if (slide.timestamp && typeof slide.timestamp === 'string' && !slide.imageUrl) {
      return true;
    }
    
    // Check if a slide has transcriptTimestamps but no imageUrls
    if (slide.transcriptTimestamps && 
        Array.isArray(slide.transcriptTimestamps) && 
        slide.transcriptTimestamps.length > 0 &&
        (!slide.imageUrls || !Array.isArray(slide.imageUrls) || slide.imageUrls.length === 0)) {
      return true;
    }
    
    return false;
  });
};
