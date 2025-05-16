
import { supabase } from "@/integrations/supabase/client";

/**
 * Updates the metadata for a project to flag it for chunking
 * @param projectId The ID of the project to update
 * @returns A result object indicating success or error
 */
export const forceUpdateChunkingMetadata = async (
  projectId: string,
  transcriptionProvider: 'openai' | 'google' = 'openai'
): Promise<{ success: boolean, error?: string }> => {
  try {
    // Get the current project data
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('video_metadata')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      return { success: false, error: projectError.message };
    }

    if (!projectData) {
      return { success: false, error: "Project not found" };
    }

    // Update the video metadata to indicate chunking is needed
    const newMetadata = {
      ...(projectData.video_metadata || {}),
      chunking: {
        isChunked: true,
        isVirtualChunking: true,  // Set to true for client-side chunking
        status: 'pending',
        chunks: [],
        createdAt: new Date().toISOString(),
        transcriptionProvider: transcriptionProvider
      }
    };

    // Update the database with the new metadata
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        video_metadata: newMetadata
      })
      .eq('id', projectId);

    if (updateError) {
      console.error("Error updating project metadata:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in forceUpdateChunkingMetadata:", error);
    return { success: false, error: error.message };
  }
};
