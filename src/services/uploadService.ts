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

    // Check if we have enough storage space left
    const { data: storageInfoArray } = await supabase.rpc('get_user_storage_info');
    
    if (storageInfoArray) {
      // Handle the case where storageInfo comes as an array
      const storageInfo = Array.isArray(storageInfoArray) ? storageInfoArray[0] : storageInfoArray;
      
      if (storageInfo) {
        const storageUsed = storageInfo.storage_used || 0;
        const storageLimit = storageInfo.storage_limit || 0;
        
        if (storageUsed + file.size > storageLimit) {
          toast.error(`Not enough storage space. Your current tier (${storageInfo.tier_name}) has a limit of ${(storageLimit / 1024 / 1024).toFixed(0)}MB.`);
          return null;
        }
      }
    }

    // Upload file to Supabase storage
    const { data, error } = await supabase
      .storage
      .from('video_uploads')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading file:', error);
      throw error;
    }

    // Update the user's storage usage
    await supabase.rpc('update_storage_usage', {
      file_size_change: file.size
    });

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
 * Get duration and other metadata from video file
 * @param file Video file
 * @returns Promise with duration in seconds and other metadata
 */
export const getVideoMetadata = async (file: File): Promise<{ 
  duration: number; 
  originalFileName: string;
  fileType: string;
  fileSize: number;
} | null> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        // Round to nearest second for consistency
        const duration = Math.round(video.duration);
        resolve({
          duration,
          originalFileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        console.error('Error loading video metadata');
        resolve({
          duration: 0,
          originalFileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    } catch (error) {
      console.error('Error getting video metadata:', error);
      resolve(null);
    }
  });
};

/**
 * Creates a new project from an uploaded video file
 * @param file Video file to be uploaded
 * @param title Project title
 * @param contextPrompt Optional context prompt to guide slide generation
 * @param transcript Optional transcript text to enhance slide generation
 * @param slidesPerMinute Optional number of slides per minute (controls slide density)
 * @returns The created project
 */
export const createProjectFromVideo = async (
  file: File, 
  title: string = 'New Project',
  contextPrompt: string = '',
  transcript: string = '',
  slidesPerMinute: number = 6
): Promise<Project | null> => {
  try {
    // Upload the video file
    const uploadResult = await uploadFile(file);
    
    if (!uploadResult) {
      throw new Error('Failed to upload video file');
    }

    // Get video metadata
    const metadata = await getVideoMetadata(file);
    
    // Create a new project
    const projectData = {
      title: title || `Project from ${file.name}`,
      source_type: 'video',
      source_file_path: uploadResult.path,
      source_url: uploadResult.url,
      context_prompt: contextPrompt,
      transcript: transcript || null, // Add transcript if provided
      slides_per_minute: slidesPerMinute, // Add slides per minute
      video_metadata: metadata ? {
        duration: metadata.duration,
        original_file_name: metadata.originalFileName,
        file_type: metadata.fileType,
        file_size: metadata.fileSize
      } : null,
      extracted_frames: [],
      user_id: (await supabase.auth.getUser()).data.user?.id as string
    };

    const project = await createProject(projectData as any);
    
    toast.success('Project created successfully');
    
    // Trigger transcription process if no transcript provided
    if (!transcript) {
      toast.loading('Starting transcription process...', { id: 'transcribe-video' });
      
      try {
        const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/transcribe-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ projectId: project.id })
        });
        
        if (response.ok) {
          toast.success('Video transcription started. This may take a few minutes.', { id: 'transcribe-video' });
        } else {
          const errorData = await response.json();
          console.error('Transcription failed:', errorData);
          toast.error('Failed to start transcription. You can try again later.', { id: 'transcribe-video' });
        }
      } catch (error) {
        console.error('Transcription request error:', error);
        toast.error('Failed to start transcription. You can try again later.', { id: 'transcribe-video' });
      }
    }
    
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
 * @param slidesPerMinute Optional number of slides per minute (controls slide density)
 * @returns The created project
 */
export const createProjectFromUrl = async (
  url: string, 
  title: string = 'New Project',
  contextPrompt: string = '',
  slidesPerMinute: number = 6
): Promise<Project | null> => {
  try {
    // Create a new project
    const projectData = {
      title: title || `Project from URL`,
      source_type: 'url',
      source_url: url,
      context_prompt: contextPrompt,
      slides_per_minute: slidesPerMinute, // Add slides per minute
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
 * @param title Project title (optional)
 * @param contextPrompt Optional context prompt to guide slide generation (optional)
 * @param imageFile Optional image file to attach to the project (optional)
 * @param slidesPerMinute Optional number of slides per minute (controls slide density)
 * @returns The created project
 */
export const createProjectFromTranscript = async (
  transcript: string, 
  title: string = 'New Project',
  contextPrompt: string = '',
  imageFile?: File | null,
  slidesPerMinute: number = 6
): Promise<Project | null> => {
  try {
    // Initialize the project data
    const projectData: any = {
      title: title || 'Project from transcript',
      source_type: 'transcript',
      transcript: transcript,
      context_prompt: contextPrompt,
      slides_per_minute: slidesPerMinute, // Add slides per minute
      user_id: (await supabase.auth.getUser()).data.user?.id as string
    };

    // If an image file was provided, upload it
    if (imageFile) {
      const uploadResult = await uploadFile(imageFile);
      
      if (uploadResult) {
        projectData.image_path = uploadResult.path;
        projectData.image_url = uploadResult.url;
      }
    }

    // Create the project
    const project = await createProject(projectData);
    
    toast.success('Project created successfully');
    return project;
  } catch (error) {
    console.error('Error creating project from transcript:', error);
    toast.error('Failed to create project');
    return null;
  }
};

/**
 * Triggers video transcription for a project
 * @param projectId ID of the project to transcribe
 * @returns Object containing success status and transcript if successful
 */
export const transcribeVideo = async (projectId: string): Promise<{ success: boolean; transcript?: string }> => {
  try {
    toast.loading('Transcribing video...', { id: 'transcribe-video' });
    
    const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/transcribe-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({ projectId })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to transcribe video');
    }
    
    const { transcript } = await response.json();
    
    toast.success('Video transcribed successfully!', { id: 'transcribe-video' });
    return { success: true, transcript };
  } catch (error) {
    console.error('Error transcribing video:', error);
    toast.error(`Failed to transcribe video: ${error.message}`, { id: 'transcribe-video' });
    return { success: false };
  }
};
