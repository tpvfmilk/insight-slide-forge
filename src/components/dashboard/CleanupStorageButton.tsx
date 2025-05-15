
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { syncStorageUsage } from "@/services/storageUsageService";

export function CleanupStorageButton() {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleCleanup = async () => {
    try {
      setIsLoading(true);
      
      // Get the current user's session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("You must be logged in to clean up storage");
        return;
      }
      
      toast.info("Cleaning up storage...");
      
      // Call the cleanup function using standard functions.invoke method
      const response = await supabase.functions.invoke("cleanup-orphaned-files", {
        body: { forceDeleteAll: true }
      });
      
      if (response.error) {
        throw new Error(response.error.message || "Unknown error");
      }
      
      // Show success message with details
      if (response.data.success) {
        toast.success(response.data.message);
        
        // Force sync storage info
        const syncResult = await syncStorageUsage();
        
        if (!syncResult.success) {
          console.warn("Storage sync warning:", syncResult.message);
          // Continue with page reload even if sync fails
        }
        
        // Refresh the page to update storage usage display
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(response.data.error || "Failed to clean up storage");
      }
    } catch (error) {
      console.error("Error cleaning up storage:", error);
      toast.error(`Failed to clean up storage: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Button
      onClick={handleCleanup}
      variant="destructive"
      disabled={isLoading}
      size="sm"
      className="mt-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Cleaning...
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All Storage
        </>
      )}
    </Button>
  );
}
