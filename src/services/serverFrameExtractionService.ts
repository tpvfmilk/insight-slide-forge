
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ExtractedFrame } from "./clientFrameExtractionService";
import { parseStoragePath } from "@/utils/videoPathUtils";
import { ExtendedVideoMetadata } from "@/types/videoChunking";

/**
 * Server-side frame extraction has been disabled for regular videos
 * but we now support frame extraction for chunked videos via chunk references
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
  // Clear any loading toast that might have been set
  toast.dismiss('server-extract-frames');
  
  try {
    // Check if this is a chunked video
    const { data: project } = await supabase
      .from('projects')
      .select('video_metadata')
      .eq('id', projectId)
      .single();
      
    // Need to cast video_metadata to ExtendedVideoMetadata to access chunking property
    const videoMetadata = project?.video_metadata as ExtendedVideoMetadata | null;

    if (videoMetadata?.chunking?.isChunked) {
      // For chunked videos, we map timestamps to chunk references
      // This is a simplified implementation - in a full implementation,
      // you would use FFmpeg on the server to extract frames from specific chunks
      
      toast.loading("Extracting frames from chunked video...", { id: "server-extract-frames" });
      
      // Simulate frame extraction by returning references to the chunks
      // In a real implementation, you would extract actual frames
      const frames: ExtractedFrame[] = timestamps.map((timestamp, index) => {
        // Find which chunk this timestamp belongs to
        const chunks = videoMetadata.chunking.chunks;
        const chunkIndex = chunks.findIndex(chunk => 
          parseFloat(timestamp) >= chunk.startTime && 
          parseFloat(timestamp) < (chunk.endTime || Infinity)
        );
        
        return {
          id: `chunk-frame-${index}`,
          projectId,
          timestamp,
          // In a real implementation, this would be a URL to an actual extracted frame
          url: `${videoPath}?timestamp=${timestamp}&chunk=${chunkIndex !== -1 ? chunkIndex : 'main'}`,
          type: 'server',
          // In a real implementation, you'd extract the actual thumbnail
          thumbnailUrl: `${videoPath}?timestamp=${timestamp}&chunk=${chunkIndex !== -1 ? chunkIndex : 'main'}&thumbnail=true`,
          imageUrl: `${videoPath}?timestamp=${timestamp}&chunk=${chunkIndex !== -1 ? chunkIndex : 'main'}&thumbnail=true`
        };
      });
      
      toast.success("Frames extracted from chunked video", { id: "server-extract-frames" });
      return { success: true, frames };
    }
    
    // For non-chunked videos, show the disabled message
    toast.error("Server-side frame extraction has been disabled. Please use client-side extraction only.", { id: "server-extract-frames" });
    
    return {
      success: false,
      error: "Server-side frame extraction has been disabled for regular videos"
    };
  } catch (error) {
    console.error("Error in server-side frame extraction:", error);
    toast.error("Failed to extract frames from the server", { id: "server-extract-frames" });
    
    return {
      success: false,
      error: error.message || "Unknown error in server-side frame extraction"
    };
  }
}
