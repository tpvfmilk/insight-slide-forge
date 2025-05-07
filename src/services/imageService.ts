
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { initializeStorage } from "./storageService";

/**
 * Uploads an image file to Supabase storage for slides
 * @param file Image file to be uploaded
 * @returns Object containing file path and URL
 */
export const uploadSlideImage = async (file: File): Promise<{ path: string; url: string } | null> => {
  try {
    // Ensure storage buckets are initialized before uploading
    await initializeStorage();
    
    // Check if it's a valid image file
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }
    
    // Generate a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `slides/${fileName}`;

    // Check if slide_images bucket exists
    try {
      const { data: bucket, error: bucketError } = await supabase
        .storage
        .getBucket('slide_images');
        
      if (bucketError) {
        console.error('Error checking slide_images bucket:', bucketError);
        // We'll continue anyway since initializeStorage should have created it
      }
    } catch (bucketError) {
      console.error('Exception checking slide_images bucket:', bucketError);
      // Continue with upload attempt
    }

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
