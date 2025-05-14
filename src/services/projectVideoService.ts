
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";

// Define types for project videos
export type ProjectVideo = Database["public"]["Tables"]["project_videos"]["Row"] & {
  video_metadata?: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  };
  extracted_frames?: ExtractedFrame[] | null;
};

/**
 * Fetches all videos for a specific project
 * @param projectId Project ID
 */
export const fetchProjectVideos = async (projectId: string): Promise<ProjectVideo[]> => {
  console.log(`Fetching videos for project ${projectId}`);
  
  // FIX: Use explicit table name to avoid ambiguous column references
  const { data, error } = await supabase
    .from('project_videos')
    .select('*')
    .eq('project_videos.project_id', projectId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error(`Error fetching videos for project ${projectId}:`, error);
    // Return empty array instead of throwing so the app can continue
    return [];
  }

  console.log(`Found ${data?.length || 0} videos for project ${projectId}`, data);

  // Cast data to ProjectVideo[] with proper handling of JSON fields
  return (data || []).map(video => {
    const typedVideo: ProjectVideo = {
      ...video,
      // Cast video_metadata JSON to the correct type if present
      video_metadata: video.video_metadata as ProjectVideo['video_metadata'],
      // Cast extracted_frames JSON to the correct type if present
      extracted_frames: video.extracted_frames as unknown as ExtractedFrame[] | null
    };
    return typedVideo;
  });
};

/**
 * Fetches a specific project video by ID
 * @param id Project video ID
 */
export const fetchProjectVideoById = async (id: string): Promise<ProjectVideo | null> => {
  const { data, error } = await supabase
    .from('project_videos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching project video with ID ${id}:`, error);
    throw error;
  }

  if (!data) return null;

  // Cast data to ProjectVideo with proper handling of JSON fields
  const typedVideo: ProjectVideo = {
    ...data,
    // Cast video_metadata JSON to the correct type if present
    video_metadata: data.video_metadata as ProjectVideo['video_metadata'],
    // Cast extracted_frames JSON to the correct type if present
    extracted_frames: data.extracted_frames as unknown as ExtractedFrame[] | null
  };
  
  return typedVideo;
};

/**
 * Creates a new project video
 * @param videoData Project video data
 */
export const createProjectVideo = async (videoData: Omit<ProjectVideo, 'id' | 'created_at' | 'updated_at'>): Promise<ProjectVideo> => {
  console.log("Creating project video:", videoData);
  
  const { data, error } = await supabase
    .from('project_videos')
    .insert(videoData)
    .select()
    .single();

  if (error) {
    console.error('Error creating project video:', error);
    throw error;
  }

  console.log("Project video created successfully:", data);

  // Cast data to ProjectVideo with proper handling of JSON fields
  const typedVideo: ProjectVideo = {
    ...data,
    // Cast video_metadata JSON to the correct type if present
    video_metadata: data.video_metadata as ProjectVideo['video_metadata'],
    // Cast extracted_frames JSON to the correct type if present
    extracted_frames: data.extracted_frames as unknown as ExtractedFrame[] | null
  };
  
  return typedVideo;
};

/**
 * Updates an existing project video
 * @param id Project video ID
 * @param videoData Updated project video data
 */
export const updateProjectVideo = async (id: string, videoData: Partial<ProjectVideo>): Promise<void> => {
  const { error } = await supabase
    .from('project_videos')
    .update(videoData)
    .eq('id', id);

  if (error) {
    console.error(`Error updating project video with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Deletes a project video
 * @param id Project video ID
 */
export const deleteProjectVideo = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('project_videos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting project video with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Updates the display order of multiple videos
 * @param videos Array of videos with id and new display_order
 */
export const updateVideosOrder = async (videos: Array<{ id: string, display_order: number }>): Promise<void> => {
  try {
    // Unfortunately, Supabase doesn't support bulk updates in a single call,
    // so we need to make multiple update calls in sequence
    for (const video of videos) {
      const { error } = await supabase
        .from('project_videos')
        .update({ display_order: video.display_order })
        .eq('id', video.id);
        
      if (error) {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error updating videos order:', error);
    toast.error('Failed to update video order');
    throw error;
  }
};

/**
 * Gets the next available display order for a new video
 * @param projectId Project ID
 */
export const getNextDisplayOrder = async (projectId: string): Promise<number> => {
  console.log(`Getting next display order for project ${projectId}`);
  
  const { data, error } = await supabase
    .from('project_videos')
    .select('display_order')
    .eq('project_id', projectId)
    .order('display_order', { ascending: false })
    .limit(1);
    
  if (error) {
    console.error(`Error getting next display order for project ${projectId}:`, error);
    return 0;
  }
  
  const nextOrder = data.length > 0 ? (data[0].display_order + 1) : 0;
  console.log(`Next display order for project ${projectId} is ${nextOrder}`);
  
  return nextOrder;
};
