
import { supabase } from "@/integrations/supabase/client";
import { ChunkingInfo, ExtendedVideoMetadata, Json } from "@/types/videoChunking";

/**
 * Analyzes a video file to determine if chunking is needed
 * @param videoFile The video file to analyze
 * @returns ExtendedVideoMetadata with basic info about the video
 */
export const analyzeVideoForChunking = async (videoFile: File): Promise<ExtendedVideoMetadata | null> => {
  try {
    // Basic video metadata extraction
    const metadata: ExtendedVideoMetadata = {
      original_file_name: videoFile.name,
      file_type: videoFile.type,
      file_size: videoFile.size,
    };
    
    // Use the HTML5 video element to get video duration if possible
    try {
      const url = URL.createObjectURL(videoFile);
      const video = document.createElement('video');
      
      video.preload = 'metadata';
      
      const durationPromise = new Promise<number>((resolve) => {
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve(video.duration);
        };
        
        // Set a timeout in case the metadata loading takes too long
        setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve(0); // Use 0 as a fallback duration
        }, 5000);
      });
      
      video.src = url;
      const duration = await durationPromise;
      
      metadata.duration = duration;
      console.log(`[DEBUG] Video duration: ${duration} seconds`);
    } catch (e) {
      console.warn('[DEBUG] Could not extract video duration:', e);
    }
    
    return metadata;
  } catch (error) {
    console.error('[DEBUG] Error analyzing video file:', error);
    return null;
  }
};

/**
 * Determines if a video needs to be chunked based on its size
 * @param fileSize The size of the video file in bytes
 * @returns boolean indicating if chunking is needed
 */
export const videoNeedsChunking = (fileSize: number): boolean => {
  // If file is larger than 50MB, it should be chunked
  return fileSize > 50 * 1024 * 1024;
};

/**
 * Initiates server-side chunking process by calling the edge function
 * @param projectId The ID of the project
 * @param originalVideoPath The path to the original video in storage
 * @returns Promise with success status and optional error message
 */
export const initiateServerSideChunking = async (
  projectId: string, 
  originalVideoPath: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`[DEBUG] Initiating server-side chunking for project: ${projectId}`);
    
    // Get the current video metadata from the project
    const { data: project } = await supabase
      .from('projects')
      .select('video_metadata')
      .eq('id', projectId)
      .single();
      
    if (!project) {
      return { 
        success: false,
        error: "Project not found" 
      };
    }
    
    const videoMetadata = project.video_metadata as ExtendedVideoMetadata;
    
    // Prepare chunking info if it doesn't exist
    const chunkingInfo: ChunkingInfo = videoMetadata?.chunking || {
      isChunked: true,
      chunks: [],
      status: "pending",
      totalDuration: videoMetadata?.duration || 0
    };
    
    // Call the edge function to perform chunking
    const response = await supabase.functions.invoke('video-chunker', {
      body: {
        projectId,
        originalVideoPath,
        chunkingMetadata: chunkingInfo
      }
    });
    
    if (response.error) {
      console.error("[DEBUG] Edge function error:", response.error);
      return {
        success: false,
        error: `Edge function error: ${response.error.message || response.error}`
      };
    }
    
    const result = response.data;
    console.log("[DEBUG] Chunking result:", result);
    
    if (!result || result.error) {
      return {
        success: false,
        error: result?.error || "Unknown error during chunking"
      };
    }
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error("[DEBUG] Error initiating server-side chunking:", error);
    return {
      success: false,
      error: error.message || "Unknown error during chunking"
    };
  }
};

/**
 * Force updates the chunking metadata for a project
 * @param projectId The ID of the project
 * @returns Promise with success status and optional error message
 */
export const forceUpdateChunkingMetadata = async (projectId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get current project data
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (!project) {
      return { 
        success: false,
        error: "Project not found" 
      };
    }
    
    const videoMetadata = project.video_metadata as ExtendedVideoMetadata;
    
    if (!videoMetadata) {
      return { 
        success: false,
        error: "No video metadata found" 
      };
    }
    
    // Update the chunking flag
    videoMetadata.chunking = {
      isChunked: true,
      totalDuration: videoMetadata.duration || 0,
      chunks: [],
      status: "prepared"
    };
    
    // Update the project
    const { error } = await supabase
      .from('projects')
      .update({ 
        video_metadata: videoMetadata as Json
      })
      .eq('id', projectId);
      
    if (error) {
      console.error("[DEBUG] Error updating chunking metadata:", error);
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error("[DEBUG] Error forcing chunking metadata update:", error);
    return {
      success: false,
      error: error.message || "Unknown error updating metadata"
    };
  }
};
