
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
      return { success: false, message: "Failed to sync storage usage" };
    }
    
    const data = response.data;
    const sizeDiffMB = Math.abs((data.actualSize - data.previouslyTrackedSize) / (1024 * 1024)).toFixed(2);
    
    return { 
      success: true, 
      message: `Storage usage updated (${sizeDiffMB} MB ${data.actualSize > data.previouslyTrackedSize ? 'added' : 'removed'})`
    };
  } catch (error) {
    console.error("Error syncing storage usage:", error);
    return { success: false, message: "Error syncing storage usage" };
  }
};
