
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Syncs the user's actual storage usage from storage.objects to the user_storage table
 * @returns Promise resolving to sync results or error
 */
export const syncStorageUsage = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Get current user session
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      return { success: false, message: "No active session" };
    }
    
    const userId = session.session.user.id;
    
    // Call the edge function to sync storage
    const response = await supabase.functions.invoke('sync-storage-usage', {
      body: { userId }
    });
    
    if (response.error) {
      console.error("Storage sync error:", response.error);
      return { success: false, message: `Failed to sync storage usage: ${response.error.message || 'Unknown error'}` };
    }
    
    // Check if data exists in the response
    if (!response.data) {
      return { success: false, message: "No data returned from storage sync function" };
    }
    
    const data = response.data;
    
    // Handle success response - data might have previous_size and new_size
    if (data.success) {
      let message = "Storage usage updated successfully";
      
      // If we have size information, provide more details
      if (data.previousStorageSize !== undefined && data.newStorageSize !== undefined) {
        const prevSize = Math.round(data.previousStorageSize / (1024 * 1024));
        const newSize = Math.round(data.newStorageSize / (1024 * 1024));
        message = `Storage usage updated: ${newSize} MB (was ${prevSize} MB)`;
      }
      
      return { success: true, message };
    }
    
    return { 
      success: false, 
      message: data.message || "Unknown error updating storage usage" 
    };
  } catch (error) {
    console.error("Error syncing storage usage:", error);
    return { success: false, message: `Error syncing storage usage: ${error.message || 'Unknown error'}` };
  }
};
