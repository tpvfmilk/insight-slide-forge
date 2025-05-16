import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Track if storage has been initialized already during this session
let storageInitialized = false;

/**
 * Initializes the Supabase storage buckets required by the application
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
    
    try {
      // First check if init-storage-buckets function exists
      const response = await supabase.functions.invoke('init-storage-buckets', {
        body: {}
      });
      
      if (response.error) {
        console.error("Storage initialization failed:", response.error);
        toast.error("Failed to initialize storage buckets");
        return false;
      }
      
      console.log("Storage initialization result:", response.data);
      
      // Check if all buckets were successfully created
      const results = response.data?.results || [];
      const anyErrors = results.some(r => r.status === 'error');
      
      if (anyErrors) {
        console.warn("Some storage buckets encountered errors during initialization");
      } else {
        console.log("Storage initialized successfully");
        storageInitialized = true;
      }
      
      return !anyErrors;
    } catch (fetchError) {
      console.error("Error calling init-storage-buckets function:", fetchError);
      
      // Try alternate function name
      try {
        const response = await supabase.functions.invoke('create-storage-buckets', {
          body: {}
        });
        
        if (response.error) {
          console.error("Alternate storage initialization failed:", response.error);
          toast.error("Failed to initialize storage buckets");
          return false;
        }
        
        storageInitialized = true;
        return true;
      } catch (altError) {
        console.error("Error with alternate storage initialization:", altError);
        return false;
      }
    }
  } catch (error) {
    console.error("Error initializing storage:", error);
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
      { bucket: 'audio_chunks', path: `${projectId}/.directory` },
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

/**
 * Verifies that all required storage buckets exist and are accessible
 * @returns Promise resolving to an object with bucket status information
 */
export const verifyStorageBuckets = async (): Promise<{ success: boolean, results: any[] }> => {
  try {
    console.log("Verifying storage buckets...");
    
    const requiredBuckets = [
      'video_uploads',
      'chunks',
      'audio_extracts',
      'audio_chunks',
      'slide_stills'
    ];
    
    const results = [];
    let allBucketsAvailable = true;
    
    // First check if the storage API is available at all
    try {
      // Try to get a list of buckets
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        // If listBuckets fails, storage might not be enabled
        console.error("Storage API unavailable:", listError);
        return {
          success: false,
          results: [{ bucket: 'all', status: 'error', message: 'Storage API unavailable' }]
        };
      }
      
      // Map of existing bucket names for quick access
      const existingBuckets = buckets ? buckets.reduce((acc, bucket) => {
        acc[bucket.name] = bucket;
        return acc;
      }, {}) : {};
      
      // Check each required bucket
      for (const bucketId of requiredBuckets) {
        if (existingBuckets[bucketId]) {
          // Bucket exists, check if we can list files in it
          try {
            const { data, error } = await supabase.storage
              .from(bucketId)
              .list('', { limit: 1 });
              
            if (error) {
              results.push({ bucket: bucketId, status: 'error', message: error.message });
              allBucketsAvailable = false;
            } else {
              results.push({ bucket: bucketId, status: 'available', itemCount: data?.length || 0 });
            }
          } catch (accessError) {
            results.push({ bucket: bucketId, status: 'error', message: accessError.message });
            allBucketsAvailable = false;
          }
        } else {
          // Bucket doesn't exist
          results.push({ bucket: bucketId, status: 'missing' });
          allBucketsAvailable = false;
        }
      }
    } catch (storageApiError) {
      console.error("Error accessing Storage API:", storageApiError);
      return {
        success: false,
        results: [{ bucket: 'all', status: 'error', message: 'Storage API error' }]
      };
    }
    
    return {
      success: allBucketsAvailable,
      results
    };
  } catch (error) {
    console.error("Error verifying storage buckets:", error);
    return {
      success: false,
      results: [{ status: 'error', message: error.message }]
    };
  }
};
