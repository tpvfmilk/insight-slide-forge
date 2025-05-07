
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Initializes the Supabase storage buckets required by the application
 * Creates video_uploads and slide_images buckets if they don't exist
 * @returns Promise resolving to a success/failure status
 */
export const initializeStorage = async (): Promise<boolean> => {
  try {
    console.log("Initializing storage buckets...");
    
    const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/init-storage', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Storage initialization failed:", errorData);
      return false;
    }
    
    const data = await response.json();
    console.log("Storage initialization result:", data);
    return data.success === true;
  } catch (error) {
    console.error("Error initializing storage:", error);
    return false;
  }
};
