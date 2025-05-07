
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

/**
 * Uploads an image file to Supabase storage for slides
 * @param file Image file to be uploaded
 * @returns Object containing file path and URL
 */
export const uploadSlideImage = async (file: File): Promise<{ path: string; url: string } | null> => {
  try {
    // Check if it's a valid image file
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }
    
    // Generate a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `slides/${fileName}`;

    // Upload file to Supabase storage
    const { data, error } = await supabase
      .storage
      .from('slide_images')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }

    // Get the public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('slide_images')
      .getPublicUrl(data.path);

    return {
      path: data.path,
      url: publicUrl
    };
  } catch (error) {
    console.error('Error in uploadSlideImage:', error);
    return null;
  }
};
