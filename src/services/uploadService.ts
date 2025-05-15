
import { supabase } from "@/integrations/supabase/client";
import { Project } from "@/services/projectService";
import { toast } from "sonner";
import { parseStoragePath } from "@/utils/videoPathUtils";

// Update this function to remove the slides per minute parameter
export const createProjectFromVideo = async (
  videoFile: File,
  title: string,
  contextPrompt: string = "",
  transcript: string = ""
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
    
    // Get video metadata
    const videoMetadata = {
      original_file_name: videoFile.name,
      file_type: videoFile.type,
      file_size: videoFile.size,
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

export const transcribeVideo = async (projectId: string, projectVideos: any[] = []): Promise<{ success: boolean; transcript?: string; error?: string }> => {
  try {
    // Verify user is authenticated
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      toast.error("You need to be logged in to transcribe a video");
      return { success: false, error: "Authentication required" };
    }

    toast.loading("Transcribing video...", { id: "transcribe-video" });
    
    // Get project details to verify file paths
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (project) {
      console.log(`Transcribing project: ${project.title}`);
      console.log(`Source path: ${project.source_file_path}`);
      console.log(`Source type: ${project.source_type}`);
      
      if (project.source_file_path) {
        // Check if the file exists in storage
        const { bucketName, filePath } = parseStoragePath(project.source_file_path);
        console.log(`Checking file existence at ${bucketName}/${filePath}`);
        
        try {
          // Verify the file exists by attempting to get its public URL
          // Note: getPublicUrl doesn't return an error property, it always returns { data: { publicUrl: string } }
          const { data: fileData } = await supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);
            
          console.log(`Storage public URL check: ${fileData?.publicUrl ? 'URL available' : 'No URL available'}`);
        } catch (e) {
          console.warn("Error checking file existence:", e);
        }
      }
    }

    // Additional debugging info for project videos
    if (projectVideos && projectVideos.length > 0) {
      console.log(`Video details for ${projectVideos.length} videos:`);
      projectVideos.forEach((video, i) => {
        console.log(`Video ${i+1}: ${video.title || 'Untitled'}`);
        console.log(`- Path: ${video.source_file_path}`);
        console.log(`- Has metadata: ${video.video_metadata ? 'Yes' : 'No'}`);
      });
    }

    // Call the edge function to transcribe the video
    console.log(`Calling transcribe-video function for project ${projectId}`);
    console.log(`Providing ${projectVideos.length} project videos`);
    
    const response = await supabase.functions.invoke('transcribe-video', {
      body: {
        projectId: projectId,
        projectVideos: projectVideos
      }
    });

    console.log("Edge function response received", response);

    if (response.error) {
      console.error("Error from transcribe-video edge function:", response.error);
      return { 
        success: false, 
        error: response.error?.message || "Error calling transcription service" 
      };
    }

    const { transcript, error } = response.data || {};

    if (error) {
      console.error("Error in transcription response:", error);
      return { 
        success: false, 
        error: error 
      };
    }

    if (!transcript) {
      return { 
        success: false, 
        error: "No transcript was generated" 
      };
    }

    toast.success("Video transcribed successfully!", { id: "transcribe-video" });
    return { success: true, transcript: transcript };
  } catch (error: any) {
    console.error("Error transcribing video:", error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred" 
    };
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
