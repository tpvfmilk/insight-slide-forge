
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Folder {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface CreateFolderData {
  name: string;
  description?: string;
}

export interface UpdateFolderData {
  name?: string;
  description?: string;
}

/**
 * Fetch all folders for the current user
 */
export const fetchFolders = async (): Promise<Folder[]> => {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching folders:', error);
    throw error;
  }

  return (data || []) as Folder[];
};

/**
 * Create a new folder
 */
export const createFolder = async (folderData: CreateFolderData): Promise<Folder> => {
  const { data, error } = await supabase
    .from('folders')
    .insert([folderData])
    .select()
    .single();

  if (error) {
    console.error('Error creating folder:', error);
    throw error;
  }

  return data as Folder;
};

/**
 * Update an existing folder
 */
export const updateFolder = async (id: string, folderData: UpdateFolderData): Promise<void> => {
  const { error } = await supabase
    .from('folders')
    .update(folderData)
    .eq('id', id);

  if (error) {
    console.error(`Error updating folder with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a folder
 */
export const deleteFolder = async (id: string): Promise<void> => {
  // First, unlink any projects from this folder
  const { error: updateError } = await supabase
    .from('projects')
    .update({ folder_id: null })
    .eq('folder_id', id);

  if (updateError) {
    console.error(`Error unlinking projects from folder with ID ${id}:`, updateError);
    throw updateError;
  }

  // Then delete the folder
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting folder with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Move projects to a folder
 */
export const moveProjectsToFolder = async (projectIds: string[], folderId: string | null): Promise<void> => {
  const updateData = { folder_id: folderId };
  
  const { error } = await supabase
    .from('projects')
    .update(updateData)
    .in('id', projectIds);

  if (error) {
    console.error(`Error moving projects to folder:`, error);
    throw error;
  }
};

/**
 * Get folder by ID
 */
export const getFolderById = async (id: string): Promise<Folder | null> => {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching folder with ID ${id}:`, error);
    throw error;
  }

  return data as Folder | null;
};
