
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

// Extend the Database Project type with our additional fields until Supabase types are regenerated
export type Project = Database["public"]["Tables"]["projects"]["Row"] & {
  video_metadata?: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  };
  extracted_frames?: ExtractedFrame[];
};

/**
 * Fetches recent projects for the current user
 * @param limit Number of projects to fetch (default: 3)
 */
export const fetchRecentProjects = async (limit: number = 3): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent projects:', error);
    throw error;
  }

  // Cast data to Project[] with proper handling of JSON fields
  return (data || []).map(project => {
    const typedProject: Project = {
      ...project,
      // Cast video_metadata JSON to the correct type if present
      video_metadata: project.video_metadata as Project['video_metadata'],
      // Cast extracted_frames JSON to the correct type if present
      extracted_frames: project.extracted_frames as unknown as ExtractedFrame[] | undefined
    };
    return typedProject;
  });
};

/**
 * Fetches a specific project by ID
 * @param id Project ID
 */
export const fetchProjectById = async (id: string): Promise<Project | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching project with ID ${id}:`, error);
    throw error;
  }

  if (!data) return null;

  // Cast data to Project with proper handling of JSON fields
  const typedProject: Project = {
    ...data,
    // Cast video_metadata JSON to the correct type if present
    video_metadata: data.video_metadata as Project['video_metadata'],
    // Cast extracted_frames JSON to the correct type if present
    extracted_frames: data.extracted_frames as unknown as ExtractedFrame[] | undefined
  };
  
  return typedProject;
};

/**
 * Creates a new project
 * @param projectData Project data
 */
export const createProject = async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    throw error;
  }

  // Cast data to Project with proper handling of JSON fields
  const typedProject: Project = {
    ...data,
    // Cast video_metadata JSON to the correct type if present
    video_metadata: data.video_metadata as Project['video_metadata'],
    // Cast extracted_frames JSON to the correct type if present
    extracted_frames: data.extracted_frames as unknown as ExtractedFrame[] | undefined
  };
  
  return typedProject;
};

/**
 * Updates an existing project
 * @param id Project ID
 * @param projectData Updated project data
 */
export const updateProject = async (id: string, projectData: Partial<Project>): Promise<void> => {
  // If projectData contains extracted_frames, ensure it's cast correctly for Supabase
  if (projectData.extracted_frames) {
    const updatedData = {
      ...projectData,
      extracted_frames: projectData.extracted_frames as unknown as Json
    };
    
    const { error } = await supabase
      .from('projects')
      .update(updatedData)
      .eq('id', id);

    if (error) {
      console.error(`Error updating project with ID ${id}:`, error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('projects')
      .update(projectData)
      .eq('id', id);

    if (error) {
      console.error(`Error updating project with ID ${id}:`, error);
      throw error;
    }
  }
};

/**
 * Deletes a project
 * @param id Project ID
 */
export const deleteProject = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting project with ID ${id}:`, error);
    throw error;
  }
};
