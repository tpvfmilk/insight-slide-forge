
import { supabase } from "@/integrations/supabase/client";
import { Project } from "@/services/projectService";
import { toast } from "sonner";
import { 
  chunkVideoFile, 
  ChunkedVideoMetadata, 
  CHUNK_SIZE 
} from "@/services/videoChunkingService";

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
    
    // Check if the file is large enough to require chunking (>25MB)
    const shouldUseChunking = videoFile.size > 25 * 1024 * 1024;
    let filePath: string;
    let videoMetadata: any = {
      original_file_name: videoFile.name,
      file_type: videoFile.type,
      file_size: videoFile.size,
    };
    
    // Process chunked or regular upload
    if (shouldUseChunking) {
      toast.loading("Processing large video file...", { id: "chunking-video" });
      
      // Create a project ID for the chunking process
      const tempProjectId = crypto.randomUUID();
      
      // Chunk the video and upload the chunks
      const chunkedMetadata = await chunkVideoFile(
        videoFile,
        tempProjectId,
        (progress) => {
          toast.loading(`Processing video: ${Math.round(progress)}%`, { id: "chunking-video" });
        }
      );
      
      // Update metadata to include chunking information
      videoMetadata = {
        ...videoMetadata,
        chunked_video_metadata: chunkedMetadata,
      };
      
      // If the file is small enough, it might not have been chunked despite shouldUseChunking being true
      if (chunkedMetadata.isChunked) {
        filePath = `chunked_videos/${tempProjectId}/${videoFile.name}`;
        // We don't actually upload the original file, just the chunks
      } else {
        // Upload the video to Supabase storage as normal
        filePath = `uploads/${session.session.user.id}/${videoFile.name}`;
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
      }
      
      toast.success("Video processing complete", { id: "chunking-video" });
    } else {
      // Upload the video to Supabase storage (regular way for smaller files)
      filePath = `uploads/${session.session.user.id}/${videoFile.name}`;
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
    }
    
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

    // Check if we need to handle chunked videos
    let hasChunkedVideos = false;
    const videosToProcess = [...projectVideos]; // Copy to avoid mutation
    
    // If no videos were passed, get the project details to check for chunking
    if (videosToProcess.length === 0) {
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      if (projectData?.video_metadata?.chunked_video_metadata?.isChunked) {
        hasChunkedVideos = true;
      }
    } else {
      // Check if any of the provided videos are chunked
      for (const video of videosToProcess) {
        if (video.video_metadata?.chunked_video_metadata?.isChunked) {
          hasChunkedVideos = true;
          break;
        }
      }
    }

    // Call the edge function to transcribe the video
    const response = await supabase.functions.invoke('transcribe-video', {
      body: {
        projectId: projectId,
        projectVideos: videosToProcess,
        processChunks: hasChunkedVideos
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
