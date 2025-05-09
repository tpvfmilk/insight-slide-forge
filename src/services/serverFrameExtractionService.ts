
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ExtractedFrame } from "./clientFrameExtractionService";

/**
 * Server-side frame extraction has been disabled
 * This function now returns an error to indicate that this functionality is no longer available
 */
export async function serverSideExtractFrames(
  projectId: string, 
  videoPath: string, 
  timestamps: string[],
  clientSideFailed: boolean = false
): Promise<{ 
  success: boolean; 
  frames?: ExtractedFrame[]; 
  error?: string;
}> {
  console.log("Server-side frame extraction has been disabled");
  
  // Clear any loading toast that might have been set
  toast.dismiss('server-extract-frames');
  
  // Show error message
  toast.error("Server-side frame extraction has been disabled. Please use client-side extraction only.");
  
  // Return error
  return {
    success: false,
    error: "Server-side frame extraction has been disabled"
  };
}
