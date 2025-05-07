
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Initializes the Supabase storage buckets required by the application
 * Creates video_uploads and slide_stills buckets if they don't exist
 * @returns Promise resolving to a success/failure status
 */
export const initializeStorage = async (): Promise<boolean> => {
  try {
    console.log("Initializing storage buckets...");
    
    // Check if user is authenticated before proceeding
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      console.log("Storage initialization skipped: User not authenticated");
      return false;
    }
    
    const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/init-storage', {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.session.access_token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Storage initialization failed:", errorData);
      toast.error("Failed to initialize storage buckets. Some features may not work correctly.");
      return false;
    }
    
    const data = await response.json();
    console.log("Storage initialization result:", data);
    return data.success === true;
  } catch (error) {
    console.error("Error initializing storage:", error);
    toast.error("Storage initialization error. Please try refreshing the page.");
    return false;
  }
};
