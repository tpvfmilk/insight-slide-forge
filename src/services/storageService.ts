
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Track if storage has been initialized already during this session
let storageInitialized = false;

/**
 * Initializes the Supabase storage buckets required by the application
 * Creates video_uploads, chunks, and slide_stills buckets if they don't exist
 * Sets buckets to public
 * @returns Promise resolving to a success/failure status
 */
export const initializeStorage = async (): Promise<boolean> => {
  try {
    // If we've already successfully initialized storage in this session, don't do it again
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
    
    // Call our edge function to init the buckets with proper permissions
    try {
      const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/init-storage-buckets', {
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
      
      // Verify the results to make sure all required buckets were created/updated
      if (data.success) {
        // Check specifically if the required buckets are properly configured
        const videoUploadsResult = data.results.find(r => r.bucket === 'video_uploads');
        const chunksResult = data.results.find(r => r.bucket === 'chunks');
        const slidesResult = data.results.find(r => r.bucket === 'slide_stills');
        
        const allBucketsOk = videoUploadsResult && videoUploadsResult.status !== 'error' && 
                            chunksResult && chunksResult.status !== 'error' &&
                            slidesResult && slidesResult.status !== 'error';
        
        if (allBucketsOk) {
          console.log("All required buckets are properly configured");
          storageInitialized = true;
        } else {
          console.warn("One or more buckets might not be properly configured");
          console.log("Bucket results:", data.results);
          
          // Check specifically for issues with the chunks bucket
          if (!chunksResult || chunksResult.status === 'error') {
            console.error("The 'chunks' bucket was not created correctly");
            toast.error("Storage 'chunks' bucket could not be created. Video chunking will not work properly.");
          } else {
            toast.warning("Storage might not be configured correctly. Video processing may not work properly.");
          }
          
          return false;
        }
      }
      
      return data.success === true;
    } catch (fetchError) {
      console.error("Error calling init-storage-buckets function:", fetchError);
      toast.error("Storage initialization service error. Please try again.");
      return false;
    }
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

/**
 * Syncs the user's storage usage after a significant change like deleting a project
 * This will force an update of the user's storage stats in the database
 * @returns Promise resolving to success/failure status
 */
export const syncStorageUsage = async (): Promise<boolean> => {
  try {
    console.log("Syncing user's storage usage after storage changes");
    
    // Check if user is authenticated before proceeding
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      console.log("Storage sync skipped: User not authenticated");
      return false;
    }
    
    // Call the storage sync function
    const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/sync-storage-usage', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.session.access_token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Storage sync failed:", errorData);
      return false;
    }
    
    const data = await response.json();
    console.log("Storage sync result:", data);
    
    return data.success === true;
  } catch (error) {
    console.error("Error syncing storage usage:", error);
    return false;
  }
};
