
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Track if storage has been initialized already during this session
let storageInitialized = false;

/**
 * Initializes the Supabase storage buckets required by the application
 * Creates video_uploads, chunks, audio_extracts, and slide_stills buckets if they don't exist
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
      const response = await supabase.functions.invoke('create-storage-buckets');
      
      if (response.error) {
        console.error("Storage initialization failed:", response.error);
        toast.error("Failed to initialize storage buckets. Some features may not work correctly.");
        return false;
      }
      
      console.log("Storage initialization result:", response.data);
      
      // Check if all buckets were successfully created
      const results = response.data.results || [];
      const anyErrors = results.some(r => r.status === 'error');
      
      if (anyErrors) {
        console.warn("Some storage buckets encountered errors during initialization");
        toast.warning("Storage initialization partially succeeded. Some features may have limited functionality.");
      } else {
        toast.success("Storage system initialized successfully");
        storageInitialized = true;
      }
      
      // Log the results for debugging
      console.log("Bucket creation results:", results);
      
      return !anyErrors;
    } catch (fetchError) {
      console.error("Error calling create-storage-buckets function:", fetchError);
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
    
    // Call the sync function directly with supabase functions
    const response = await supabase.functions.invoke('sync-storage-usage');
    
    if (response.error) {
      console.error("Storage sync failed:", response.error);
      return false;
    }
    
    console.log("Storage sync result:", response.data);
    
    return response.data?.success === true;
  } catch (error) {
    console.error("Error syncing storage usage:", error);
    return false;
  }
};

/**
 * Creates the suggested production directory structure in storage
 * for organizing project assets
 * @param projectId The project ID to create directories for
 * @returns Promise resolving to success/failure status
 */
export const createProjectDirectoryStructure = async (projectId: string): Promise<boolean> => {
  try {
    if (!projectId) {
      console.error("Project ID is required to create directory structure");
      return false;
    }
    
    console.log(`Creating directory structure for project: ${projectId}`);
    
    // We need to create empty files to establish directory structure in Supabase Storage
    // Create an empty marker file
    const emptyBlob = new Blob([''], { type: 'text/plain' });
    
    // Define the directories we need to create
    const directories = [
      { bucket: 'video_uploads', path: `${projectId}/.directory` },
      { bucket: 'chunks', path: `${projectId}/.directory` },
      { bucket: 'audio_extracts', path: `${projectId}/.directory` },
      { bucket: 'slide_stills', path: `${projectId}/.directory` }
    ];
    
    // Create each directory by uploading the marker file
    for (const dir of directories) {
      try {
        const { error } = await supabase.storage
          .from(dir.bucket)
          .upload(dir.path, emptyBlob);
          
        if (error && !error.message.includes('The resource already exists')) {
          console.error(`Error creating directory ${dir.bucket}/${dir.path}:`, error);
        }
      } catch (dirError) {
        console.error(`Failed to create directory ${dir.bucket}/${dir.path}:`, dirError);
        // Continue to next directory even if one fails
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error creating project directory structure:", error);
    return false;
  }
};
