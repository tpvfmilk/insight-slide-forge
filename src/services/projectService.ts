import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";

// Extend the Database Project type with our additional fields until Supabase types are regenerated
export type Project = Database["public"]["Tables"]["projects"]["Row"] & {
  video_metadata?: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  };
  extracted_frames?: Array<{
    timestamp: string;
    imageUrl: string;
  }>;
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

  return data || [];
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

  return data;
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

  return data;
};

/**
 * Updates an existing project
 * @param id Project ID
 * @param projectData Updated project data
 */
export const updateProject = async (id: string, projectData: Partial<Project>): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .update(projectData)
    .eq('id', id);

  if (error) {
    console.error(`Error updating project with ID ${id}:`, error);
    throw error;
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
