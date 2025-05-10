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
 * Transcribe a video and update the project
 * @param projectId Project ID
 * @param projectVideos Optional array of project videos to transcribe
 * @returns Object containing success status and transcript if successful
 */
export const transcribeVideo = async (
  projectId: string, 
  projectVideos?: Array<{
    id: string;
    project_id: string;
    source_file_path: string;
    title?: string;
    video_metadata?: any;
  }>
): Promise<{ success: boolean; transcript?: string }> => {
  try {
    // Get the supabase session
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      toast.error("You need to be logged in to transcribe videos");
      return { success: false };
    }
    
    toast.loading("Transcribing video...", { id: "transcribe-video" });
    
    // Call the transcribe-video edge function
    const response = await supabase.functions.invoke('transcribe-video', {
      body: { 
        projectId,
        projectVideos: projectVideos || []
      }
    });
    
    if (response.error) {
      throw new Error(response.error.message || "Failed to transcribe video");
    }
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || "Failed to transcribe video");
    }
    
    toast.success("Video transcription complete", { id: "transcribe-video" });
    
    return {
      success: true,
      transcript: response.data.transcript
    };
  } catch (error) {
    console.error("Error transcribing video:", error);
    toast.error(`Transcription failed: ${error.message}`, { id: "transcribe-video" });
    return { success: false };
  }
};

/**
 * Extracts a transcription from a video without storing the video
 * @param audioBlob The audio blob extracted from the video
 * @param title Project title
 * @param useSpeakerDetection Whether to use speaker detection
 * @param contextPrompt Optional context prompt for future slide generation
 * @param slidesPerMinute Optional number of slides per minute for future slide generation
 * @returns The created project
 */
export const extractTranscriptionFromVideo = async (
  audioBlob: Blob, 
  title: string = 'New Transcript',
  useSpeakerDetection: boolean = true,
  contextPrompt: string = '',
  slidesPerMinute: number = 6
): Promise<Project | null> => {
  try {
    // Create a project for the transcript
    const projectData = {
      title: title,
      source_type: 'transcript-only',
      context_prompt: contextPrompt,
      slides_per_minute: slidesPerMinute,
      user_id: (await supabase.auth.getUser()).data.user?.id as string
    };
    
    const project = await createProject(projectData as any);
    
    if (!project || !project.id) {
      throw new Error('Failed to create project');
    }
    
    toast.loading("Processing transcript...", { id: "process-transcript" });
    
    // Convert the blob to base64 with chunking for larger files
    const chunkSize = 1024 * 1024; // 1MB chunks
    const reader = new FileReader();
    let base64Audio = '';
    
    try {
      if (audioBlob.size > 10 * 1024 * 1024) {
        console.log(`Large audio file detected (${(audioBlob.size / (1024 * 1024)).toFixed(2)}MB), using chunked processing`);
        
        // For large files, process in chunks
        const totalChunks = Math.ceil(audioBlob.size / chunkSize);
        
        for (let chunk = 0; chunk < totalChunks; chunk++) {
          const start = chunk * chunkSize;
          const end = Math.min(start + chunkSize, audioBlob.size);
          const chunkBlob = audioBlob.slice(start, end);
          
          // Process each chunk
          const chunkBase64 = await new Promise<string>((resolve) => {
            const chunkReader = new FileReader();
            chunkReader.onload = () => {
              const result = chunkReader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            chunkReader.readAsDataURL(chunkBlob);
          });
          
          base64Audio += chunkBase64;
          console.log(`Processed audio chunk ${chunk + 1}/${totalChunks}`);
        }
      } else {
        // For smaller files, process all at once
        base64Audio = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
      }
    } catch (error) {
      console.error("Error converting audio to base64:", error);
      throw new Error("Failed to process audio data");
    }
    
    console.log(`Audio converted to base64 (${(base64Audio.length / 1024 / 1024).toFixed(2)}MB)`);
    toast.loading("Sending audio for transcription...", { id: "process-transcript" });
    
    // Call the edge function to process the audio and generate a transcript
    const response = await fetch('https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/transcribe-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        projectId: project.id,
        audioData: base64Audio,
        useSpeakerDetection,
        isTranscriptOnly: true
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process transcript');
    }
    
    const { transcript } = await response.json();
    
    // Update the project with the transcript
    await updateProject(project.id, {
      transcript
    });
    
    toast.success('Transcript extracted successfully!', { id: 'process-transcript' });
    return project;
  } catch (error) {
    console.error('Error extracting transcription:', error);
    toast.error(`Failed to extract transcription: ${error.message}`, { id: 'process-transcript' });
    return null;
  }
};

/**
 * Updates a project with new data
 * @param projectId The ID of the project to update
 * @param data The data to update the project with
 * @returns The updated project
 */
export const updateProject = async (projectId: string, data: any): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('projects')
      .update(data)
      .eq('id', projectId);
    
    if (error) {
      console.error('Error updating project:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateProject:', error);
    return false;
  }
};
