
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ExtractedFrame } from "./clientFrameExtractionService";

/**
 * Extracts frames from a video using the server-side edge function
 * @param projectId ID of the project
 * @param videoPath Path to the video file in Supabase storage
 * @param timestamps Array of timestamps to extract frames at
 * @param clientSideFailed Whether client-side extraction was attempted and failed
 * @returns Object containing success status and extracted frames
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
  try {
    console.log(`Calling server-side frame extraction for ${timestamps.length} timestamps`);
    
    const toastId = 'server-extract-frames';
    toast.loading(clientSideFailed 
      ? 'Client-side extraction failed. Trying server-side extraction...' 
      : 'Extracting frames from video...', 
      { id: toastId, duration: Infinity }
    );
    
    // Call the extract-frames edge function
    const response = await fetch(`https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/extract-frames`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        projectId,
        timestamps,
        videoPath,
        fallbackToServer: true,
        clientSideFailed
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Server-side frame extraction failed');
    }
    
    const result = await response.json();
    
    if (!result.success || !result.frames) {
      throw new Error('No frames returned from server');
    }
    
    // Save these frames to the project
    await saveExtractedFramesToProject(projectId, result.frames);
    
    toast.success(`Server-side extraction complete. ${result.frames.length} frames processed.`, {
      id: toastId
    });
    
    return {
      success: true,
      frames: result.frames
    };
  } catch (error) {
    console.error('Server-side extraction error:', error);
    toast.error(`Frame extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      id: 'server-extract-frames'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in server-side extraction'
    };
  }
}

// Helper function to save extracted frames to the project
async function saveExtractedFramesToProject(projectId: string, frames: ExtractedFrame[]): Promise<void> {
  try {
    // Get existing frames
    const { data: project } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .single();
      
    const existingFrames: ExtractedFrame[] = project?.extracted_frames as unknown as ExtractedFrame[] || [];
    
    // Merge existing and new frames, avoiding duplicates
    const updatedFrames = [
      ...frames,
      ...existingFrames.filter(existing => 
        !frames.some(frame => frame.timestamp === existing.timestamp)
      )
    ];
    
    // Update project
    await supabase.from('projects').update({
      extracted_frames: updatedFrames
    }).eq('id', projectId);
    
    console.log(`Updated project with ${frames.length} new frames, total frames: ${updatedFrames.length}`);
  } catch (error) {
    console.error('Error saving extracted frames to project:', error);
    // Don't throw the error, just log it to avoid breaking the flow
  }
}
