
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Track if storage has been initialized already during this session
let storageInitialized = false;

/**
 * Initializes the Supabase storage buckets required by the application
 * Creates video_uploads and slide_stills buckets if they don't exist
 * Sets video_uploads bucket to public
 * @returns Promise resolving to a success/failure status
 */
export const initializeStorage = async (): Promise<boolean> => {
  try {
    // If we've already initialized storage in this session, don't do it again
    if (storageInitialized) {
      console.log("Storage already initialized in this session, skipping");
      return true;
    }
    
    console.log("Initializing storage buckets...");
    
    // Check if user is authenticated before proceeding
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      console.log("Storage initialization skipped: User not authenticated");
      return false;
    }
    
    // Use the functions.invoke method for more reliable calls
    const response = await supabase.functions.invoke('init-storage', {});
    
    if (response.error) {
      console.error("Storage initialization failed:", response.error);
      toast.error("Failed to initialize storage buckets. Some features may not work correctly.");
      return false;
    }
    
    console.log("Storage initialization result:", response.data);
    
    // Mark as initialized to avoid unnecessary repeat calls
    if (response.data.success) {
      storageInitialized = true;
      
      // Check specifically if the video_uploads bucket is public
      const videoUploadsResult = response.data.results.find(r => r.bucket === 'video_uploads');
      if (videoUploadsResult && videoUploadsResult.status !== 'error') {
        console.log("Video uploads bucket is properly configured");
      } else {
        console.warn("Video uploads bucket might not be properly configured");
        toast.warning("Video uploads storage might not be configured correctly. Video frame extraction may not work properly.");
      }
    }
    
    return response.data.success === true;
  } catch (error) {
    console.error("Error initializing storage:", error);
    toast.error("Storage initialization error. Please try refreshing the page.");
    return false;
  }
};

/**
 * Gets the user's storage information including usage and limits
 * @returns Promise resolving to storage information
 */
export const getUserStorageInfo = async () => {
  try {
    const { data, error } = await supabase.rpc('get_user_storage_info');
    
    if (error) {
      console.error("Error fetching user storage info:", error);
      throw error;
    }
    
    // Function returns a single row, but it comes as an array
    return Array.isArray(data) ? data[0] : data;
  } catch (error) {
    console.error("Failed to get user storage information:", error);
    return null;
  }
};

/**
 * Calculates the total storage size used by a project
 * @param projectId The project ID
 * @returns Promise resolving to the total size in bytes
 */
export const getProjectTotalSize = async (projectId: string): Promise<number> => {
  try {
    console.log(`Calculating storage size for project: ${projectId}`);
    const { data, error } = await supabase.rpc('calculate_project_storage_size', {
      project_id: projectId
    });
    
    if (error) {
      console.error("Error calculating project size:", error);
      return 0;
    }
    
    console.log(`Project ${projectId} size calculation result:`, data);
    return Number(data) || 0;
  } catch (error) {
    console.error("Failed to get project total size:", error);
    return 0;
  }
};
