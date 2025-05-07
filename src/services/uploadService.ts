import { supabase } from "@/integrations/supabase/client";
import { createProject, Project } from "@/services/projectService";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

/**
 * Uploads a file to Supabase storage
 * @param file File to be uploaded
 * @returns Object containing file path and URL
 */
export const uploadFile = async (file: File): Promise<{ path: string; url: string } | null> => {
  try {
    // Generate a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload file to Supabase storage
    const { data, error } = await supabase
      .storage
      .from('video_uploads')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading file:', error);
      throw error;
    }

    // Get the public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('video_uploads')
      .getPublicUrl(data.path);

    return {
      path: data.path,
      url: publicUrl
    };
  } catch (error) {
    console.error('Error in uploadFile:', error);
    return null;
  }
};

/**
 * Creates a new project from an uploaded video file
 * @param file Video file to be uploaded
 * @param title Project title
 * @param contextPrompt Optional context prompt to guide slide generation
 * @param transcript Optional transcript text to enhance slide generation
 * @returns The created project
 */
export const createProjectFromVideo = async (
  file: File, 
  title: string = 'New Project',
  contextPrompt: string = '',
  transcript: string = ''
): Promise<Project | null> => {
  try {
    // Upload the video file
    const uploadResult = await uploadFile(file);
    
    if (!uploadResult) {
      throw new Error('Failed to upload video file');
    }
    
    // Create a new project
    const projectData = {
      title: title || `Project from ${file.name}`,
      source_type: 'video',
      source_file_path: uploadResult.path,
      source_url: uploadResult.url,
      context_prompt: contextPrompt,
      transcript: transcript || null, // Add transcript if provided
      user_id: (await supabase.auth.getUser()).data.user?.id as string
    };

    const project = await createProject(projectData as any);
    
    toast.success('Project created successfully');
    return project;
  } catch (error) {
    console.error('Error creating project from video:', error);
    toast.error('Failed to create project');
    return null;
  }
};

/**
 * Creates a new project from a YouTube/Vimeo URL
 * @param url Video URL (YouTube or Vimeo)
 * @param title Project title
 * @param contextPrompt Optional context prompt to guide slide generation
 * @returns The created project
 */
export const createProjectFromUrl = async (
  url: string, 
  title: string = 'New Project',
  contextPrompt: string = ''
): Promise<Project | null> => {
  try {
    // Create a new project
    const projectData = {
      title: title || `Project from URL`,
      source_type: 'url',
      source_url: url,
      context_prompt: contextPrompt,
      user_id: (await supabase.auth.getUser()).data.user?.id as string
    };

    const project = await createProject(projectData as any);
    
    toast.success('Project created successfully');
    return project;
  } catch (error) {
    console.error('Error creating project from URL:', error);
    toast.error('Failed to create project');
    return null;
  }
};

/**
 * Creates a new project from transcript text
 * @param transcript Transcript text
 * @param title Project title
 * @param imageFile Optional image file to include with the transcript
 * @param contextPrompt Optional context prompt to guide slide generation
 * @returns The created project
 */
export const createProjectFromTranscript = async (
  transcript: string, 
  title: string = 'New Project',
  imageFile: File | null = null,
  contextPrompt: string = ''
): Promise<Project | null> => {
  try {
    // Upload image if provided
    let imageUploadResult = null;
    if (imageFile) {
      imageUploadResult = await uploadFile(imageFile);
      if (!imageUploadResult) {
        console.warn('Failed to upload image, continuing with transcript only');
      }
    }
    
    // Create a new project
    const projectData = {
      title: title || 'Project from transcript',
      source_type: 'transcript',
      transcript: transcript,
      source_file_path: imageUploadResult?.path || null,
      source_url: imageUploadResult?.url || null,
      context_prompt: contextPrompt,
      user_id: (await supabase.auth.getUser()).data.user?.id as string
    };

    const project = await createProject(projectData as any);
    
    toast.success('Project created successfully');
    return project;
  } catch (error) {
    console.error('Error creating project from transcript:', error);
    toast.error('Failed to create project');
    return null;
  }
};
