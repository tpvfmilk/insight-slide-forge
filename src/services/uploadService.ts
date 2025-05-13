
import { supabase } from "@/integrations/supabase/client";
import { Project } from "@/services/projectService";
import { toast } from "sonner";

// Updated function to include the duration parameter
export const createProjectFromVideo = async (
  videoFile: File,
  title: string,
  contextPrompt: string = "",
  transcript: string = "",
  duration: number = 0
): Promise<Project | null> => {
  try {
    // Verify user is authenticated
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      toast.error("You need to be logged in to create a project");
      return null;
    }
    
    // Upload the video to Supabase storage
    const filePath = `uploads/${session.session.user.id}/${videoFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('video_uploads')
      .upload(filePath, videoFile, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      console.error("File upload error:", uploadError);
      toast.error("Failed to upload video file");
      return null;
    }
    
    // Get video metadata with duration
    const videoMetadata = {
      original_file_name: videoFile.name,
      file_type: videoFile.type,
      file_size: videoFile.size,
      duration: duration || null, // Include duration if we have it
    };
    
    // Create a new project in the database
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: session.session.user.id,
        title: title,
        source_type: 'video',
        source_file_path: filePath,
        context_prompt: contextPrompt,
        transcript: transcript,
        video_metadata: videoMetadata,
      })
      .select()
      .single();
    
    if (projectError) {
      console.error("Project creation error:", projectError);
      toast.error("Failed to create project");
      return null;
    }
    
    toast.success("Project created successfully!");
    return project as Project;
  } catch (error) {
    console.error("Error creating project:", error);
    toast.error("Failed to create project");
    return null;
  }
};

export const createProjectFromTranscript = async (
  title: string,
  transcript: string,
  contextPrompt: string = ""
): Promise<Project | null> => {
  try {
    // Verify user is authenticated
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      toast.error("You need to be logged in to create a project");
      return null;
    }
    
    // Create a new project in the database
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: session.session.user.id,
        title: title,
        source_type: 'transcript-only',
        transcript: transcript,
        context_prompt: contextPrompt,
      })
      .select()
      .single();
    
    if (projectError) {
      console.error("Project creation error:", projectError);
      toast.error("Failed to create project");
      return null;
    }
    
    toast.success("Project created successfully!");
    return project as Project;
  } catch (error) {
    console.error("Error creating project:", error);
    toast.error("Failed to create project");
    return null;
  }
};

export const transcribeVideo = async (projectId: string, projectVideos: any[] = []): Promise<{ success: boolean; transcript?: string }> => {
  try {
    // Verify user is authenticated
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      toast.error("You need to be logged in to transcribe a video");
      return { success: false };
    }

    toast.loading("Transcribing video...", { id: "transcribe-video" });

    // Call the edge function to transcribe the video
    const response = await supabase.functions.invoke('transcribe-video', {
      body: {
        projectId: projectId,
        projectVideos: projectVideos
      }
    });

    if (response.error) {
      console.error("Error from transcribe-video edge function:", response.error);
      throw new Error(response.error.message || "Failed to transcribe video");
    }

    const { transcript } = response.data || {};

    if (!transcript) {
      throw new Error("No transcript was generated");
    }

    toast.success("Video transcribed successfully!", { id: "transcribe-video" });
    return { success: true, transcript: transcript };
  } catch (error) {
    console.error("Error transcribing video:", error);
    toast.error(`Failed to transcribe video: ${error.message}`, { id: "transcribe-video" });
    return { success: false };
  }
};

export const updateProject = async (projectId: string, updates: any): Promise<boolean> => {
  try {
    // Verify user is authenticated
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      toast.error("You need to be logged in to update a project");
      return false;
    }
    
    // Update the project in the database
    const { error: projectError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);
    
    if (projectError) {
      console.error("Project update error:", projectError);
      toast.error("Failed to update project");
      return false;
    }
    
    toast.success("Project updated successfully!");
    return true;
  } catch (error) {
    console.error("Error updating project:", error);
    toast.error("Failed to update project");
    return false;
  }
};
