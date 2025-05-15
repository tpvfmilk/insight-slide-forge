
import { supabase } from "@/integrations/supabase/client";
import { Project } from "@/services/projectService";
import { toast } from "sonner";
import { parseStoragePath } from "@/utils/videoPathUtils";
import { videoNeedsChunking, analyzeVideoForChunking, createVideoChunks, initiateServerSideChunking } from "@/services/videoChunkingService";
import { ExtendedVideoMetadata } from "@/types/videoChunking";

// Update this function to handle large videos through chunking
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
    
    // Analyze video file for potential chunking
    const videoMetadata = await analyzeVideoForChunking(videoFile);
    if (!videoMetadata) {
      toast.error("Failed to analyze video file");
      return null;
    }
    
    let filePath = `uploads/${session.session.user.id}/${videoFile.name}`;
    let needsChunking = false;
    
    // Check if video needs chunking
    if (videoMetadata.chunking?.isChunked) {
      needsChunking = true;
      
      // If video needs chunking, create a different path for the original file
      filePath = `chunks/${session.session.user.id}/${videoFile.name}`;
      
      // Process the video chunks
      if (videoMetadata.chunking.chunks.length > 0) {
        const updatedChunks = await createVideoChunks(
          videoFile,
          session.session.user.id, // Using user ID as temporary project ID
          videoMetadata.chunking.chunks
        );
        
        if (!updatedChunks) {
          toast.error("Failed to process video chunks");
          return null;
        }
        
        // Update the metadata with chunk paths
        videoMetadata.chunking.chunks = updatedChunks;
      }
    }
    
    if (!needsChunking) {
      // For normal-sized videos, upload the file to Supabase storage directly
      const { error: uploadError } = await supabase.storage
        .from('video_uploads')
        .upload(filePath, videoFile, {
          cacheControl: '3600',
          upsert: true // Updated to true to allow re-uploads
        });
      
      if (uploadError) {
        console.error("File upload error:", uploadError);
        toast.error("Failed to upload video file");
        return null;
      }
    }
    
    // Create a new project in the database
    // Need to cast the videoMetadata to any to avoid type issues with Supabase's Json type
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: session.session.user.id,
        title: title,
        source_type: 'video',
        source_file_path: filePath,
        context_prompt: contextPrompt,
        transcript: transcript,
        video_metadata: videoMetadata as any,
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

      // Check if the video is chunked
      const videoMetadata = project.video_metadata as ExtendedVideoMetadata;
      const isChunkedVideo = Boolean(videoMetadata?.chunking?.isChunked);
      
      // If this is a large video that needs chunking but doesn't have actual chunk files yet,
      // initiate server-side chunking first
      if (isChunkedVideo && videoMetadata?.chunking?.chunks?.some(chunk => !chunk.videoPath)) {
        console.log("Video needs chunking but chunks haven't been created yet");
        
        // Initiate server-side chunking
        const chunkingResult = await initiateServerSideChunking(projectId, project.source_file_path);
        if (!chunkingResult.success) {
          console.error("Chunking failed:", chunkingResult.error);
          toast.error("Failed to process video chunks", { id: "transcribe-video" });
          return { success: false, error: chunkingResult.error };
        }
        
        console.log("Server-side chunking initiated successfully");
      }
      
      if (isChunkedVideo) {
        console.log("This is a chunked video. Processing chunk information for transcription.");
        console.log(`Found ${videoMetadata.chunking?.chunks.length || 0} chunks.`);
        
        // Add chunking information to the project videos array if needed
        if (projectVideos.length === 0 && videoMetadata.chunking?.chunks) {
          projectVideos = videoMetadata.chunking.chunks.map(chunk => ({
            id: null,
            project_id: projectId,
            source_file_path: chunk.videoPath,
            title: chunk.title || `Chunk ${chunk.index + 1}`,
            video_metadata: {
              duration: chunk.duration,
              start_time: chunk.startTime,
              end_time: chunk.endTime
            }
          }));
          
          console.log(`Created ${projectVideos.length} video objects from chunks`);
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
      toast.error("Error transcribing video", { id: "transcribe-video" });
      return { 
        success: false, 
        error: response.error?.message || "Error calling transcription service" 
      };
    }

    const { transcript, error } = response.data || {};

    if (error) {
      console.error("Error in transcription response:", error);
      toast.error("Error in transcription", { id: "transcribe-video" });
      return { 
        success: false, 
        error: error 
      };
    }

    if (!transcript) {
      toast.error("No transcript was generated", { id: "transcribe-video" });
      return { 
        success: false, 
        error: "No transcript was generated" 
      };
    }

    toast.success("Video transcribed successfully!", { id: "transcribe-video" });
    return { success: true, transcript: transcript };
  } catch (error: any) {
    console.error("Error transcribing video:", error);
    toast.error("Failed to transcribe video", { id: "transcribe-video" });
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
    
    return true;
  } catch (error) {
    console.error("Error updating project:", error);
    toast.error("Failed to update project");
    return false;
  }
};
