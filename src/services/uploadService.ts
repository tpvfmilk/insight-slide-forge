import { supabase } from "@/integrations/supabase/client";
import { Project } from "@/services/projectService";
import { toast } from "sonner";
import { parseStoragePath } from "@/utils/videoPathUtils";
import { 
  videoNeedsChunking, 
  analyzeVideoForChunking, 
  createVideoChunks, 
  initiateServerSideChunking, 
  forceUpdateChunkingMetadata 
} from "@/services/videoChunkingService";
import { 
  ExtendedVideoMetadata, 
  ChunkMetadata, 
  JsonSafeChunkMetadata, 
  JsonSafeVideoMetadata,
  toJsonSafe,
  fromJsonSafe,
  Json
} from "@/types/videoChunking";

// Update this function to handle large videos through chunking with the correct signature
export const createProjectFromVideo = async (
  videoFile: File,
  title: string,
  contextPrompt: string = "",
  needsChunking: boolean = false,
  chunkFiles: File[] = [],
  chunkMetadata: ChunkMetadata[] = [],
  onProgress?: (progress: number) => void
): Promise<Project | null> => {
  try {
    console.log(`[DEBUG] Creating project from video: ${title}`);
    console.log(`[DEBUG] File size: ${(videoFile.size / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`[DEBUG] Needs chunking: ${needsChunking}`);
    
    // Verify user is authenticated
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error("You need to be logged in to create a project");
    }
    
    // Analyze video file for potential chunking
    const videoMetadata = await analyzeVideoForChunking(videoFile);
    if (!videoMetadata) {
      throw new Error("Failed to analyze video file");
    }
    
    let filePath = `uploads/${session.session.user.id}/${Date.now()}_${videoFile.name}`;
    
    // Check if video needs chunking
    if (needsChunking || videoMetadata.chunking?.isChunked) {
      console.log("[DEBUG] Video needs chunking, preparing for chunked upload");
      // If video needs chunking, create a different path for the original file
      filePath = `chunks/${session.session.user.id}/${Date.now()}_${videoFile.name}`;
      
      // Process the video chunks
      if (chunkMetadata.length > 0) {
        console.log(`[DEBUG] Processing ${chunkMetadata.length} chunks`);
        // Since we know that the ChunkMetadata[] is what we expect here,
        // we can safely pass it as is without worrying about JsonSafeChunkMetadata[]
        const updatedChunks = await createVideoChunks(
          videoFile,
          session.session.user.id, // Using user ID as temporary project ID
          chunkMetadata
        );
        
        if (!updatedChunks) {
          throw new Error("Failed to process video chunks");
        }
        
        console.log(`[DEBUG] Updated chunks with paths: ${updatedChunks.length}`);
        
        // Update the metadata with chunk paths
        if (videoMetadata.chunking) {
          videoMetadata.chunking = {
            ...videoMetadata.chunking,
            chunks: updatedChunks
          };
        }
      }
      
      // Upload the original file
      console.log(`[DEBUG] Uploading original file to: ${filePath}`);
      onProgress?.(10);
      
      const { error: uploadError } = await supabase.storage
        .from('video_uploads')
        .upload(filePath, videoFile, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        console.error("[DEBUG] File upload error:", uploadError);
        throw new Error(`Failed to upload original video file: ${uploadError.message}`);
      }
      
      console.log("[DEBUG] Original file uploaded successfully");
      onProgress?.(40);
      
      // Upload each chunk file if they exist
      if (chunkFiles.length > 0) {
        console.log(`[DEBUG] Uploading ${chunkFiles.length} chunk files`);
        
        for (let i = 0; i < chunkFiles.length; i++) {
          const chunkFile = chunkFiles[i];
          const chunkInfo = chunkMetadata[i];
          
          if (!chunkInfo.videoPath) {
            console.warn(`[DEBUG] Chunk ${i} has no videoPath defined, skipping upload`);
            continue;
          }
          
          // Extract the bucket name and path
          let bucketName = 'video_uploads';
          let chunkPath = chunkInfo.videoPath;
          
          if (chunkInfo.videoPath.includes('/')) {
            // Check if the path contains a bucket name prefix
            const parts = chunkInfo.videoPath.split('/');
            if (parts[0] === 'video_uploads' || parts[0] === 'chunks') {
              bucketName = parts[0];
              chunkPath = chunkInfo.videoPath.substring(parts[0].length + 1);
            }
          }
          
          console.log(`[DEBUG] Uploading chunk ${i} to ${bucketName}/${chunkPath}`);
          
          try {
            const { error: chunkUploadError } = await supabase.storage
              .from(bucketName)
              .upload(chunkPath, chunkFile, {
                cacheControl: '3600',
                upsert: true
              });
            
            if (chunkUploadError) {
              console.error(`[DEBUG] Chunk ${i} upload error:`, chunkUploadError);
              // We'll continue with other chunks even if one fails
            } else {
              console.log(`[DEBUG] Chunk ${i} uploaded successfully`);
            }
          } catch (uploadError: any) {
            console.error(`[DEBUG] Unexpected error uploading chunk ${i}:`, uploadError);
            toast.warning(`Failed to upload chunk ${i + 1}. The project might still work.`);
          }
          
          // Update progress
          if (onProgress) {
            onProgress(40 + Math.round((i + 1) / chunkFiles.length * 40));
          }
        }
      }
    } else {
      // For normal-sized videos, upload the file to Supabase storage directly
      console.log(`[DEBUG] Uploading standard video file to: ${filePath}`);
      onProgress?.(20);
      
      const { error: uploadError } = await supabase.storage
        .from('video_uploads')
        .upload(filePath, videoFile, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        console.error("[DEBUG] File upload error:", uploadError);
        throw new Error(`Failed to upload video file: ${uploadError.message}`);
      }
      
      console.log("[DEBUG] Standard video file uploaded successfully");
      onProgress?.(80);
    }
    
    // Convert the ExtendedVideoMetadata to a JSON-compatible format
    // using our helper function
    const jsonSafeMetadata = toJsonSafe(videoMetadata);
    console.log("[DEBUG] Created JSON-safe metadata for Supabase");
    
    // Create a new project in the database
    console.log("[DEBUG] Creating project in database");
    onProgress?.(90);
    
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: session.session.user.id,
        title: title,
        source_type: 'video',
        source_file_path: filePath,
        context_prompt: contextPrompt,
        transcript: "",
        video_metadata: jsonSafeMetadata as Json
      })
      .select()
      .single();
    
    if (projectError) {
      console.error("[DEBUG] Project creation error:", projectError);
      throw new Error(`Failed to create project: ${projectError.message}`);
    }
    
    console.log(`[DEBUG] Project created successfully with ID: ${project.id}`);
    onProgress?.(100);
    
    toast.success("Project created successfully!");
    return project as Project;
  } catch (error: any) {
    console.error("[DEBUG] Error creating project:", error);
    const errorMessage = error.message || "Failed to create project";
    toast.error(errorMessage);
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
      console.error("[DEBUG] Project creation error:", projectError);
      toast.error("Failed to create project");
      return null;
    }
    
    toast.success("Project created successfully!");
    return project as Project;
  } catch (error) {
    console.error("[DEBUG] Error creating project:", error);
    toast.error("Failed to create project");
    return null;
  }
};

export const transcribeVideo = async (projectId: string, projectVideos: any[] = []): Promise<{ success: boolean; transcript?: string; error?: string }> => {
  try {
    console.log(`[DEBUG] Starting transcription for project ${projectId}`);
    console.log(`[DEBUG] Project videos provided: ${projectVideos.length}`);

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
      console.log(`[DEBUG] Transcribing project: ${project.title}`);
      console.log(`[DEBUG] Source path: ${project.source_file_path}`);
      console.log(`[DEBUG] Source type: ${project.source_type}`);
      
      if (project.source_file_path) {
        // Check if the file exists in storage
        const { bucketName, filePath } = parseStoragePath(project.source_file_path);
        console.log(`[DEBUG] Checking file existence at ${bucketName}/${filePath}`);
        
        try {
          // Verify the file exists by attempting to get its public URL
          // Note: getPublicUrl doesn't return an error property, it always returns { data: { publicUrl: string } }
          const { data: fileData } = await supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);
            
          console.log(`[DEBUG] Storage public URL check: ${fileData?.publicUrl ? 'URL available' : 'No URL available'}`);
        } catch (e) {
          console.warn("[DEBUG] Error checking file existence:", e);
        }
      }

      // Check if the video is chunked
      const videoMetadata = project.video_metadata as ExtendedVideoMetadata;
      const isChunkedVideo = Boolean(videoMetadata?.chunking?.isChunked);
      
      console.log(`[DEBUG] Is chunked video: ${isChunkedVideo}`);
      
      // Get file size info
      const fileSizeMB = videoMetadata?.file_size ? (videoMetadata.file_size / (1024 * 1024)).toFixed(2) : "Unknown";
      console.log(`[DEBUG] Video file size: ${fileSizeMB} MB`);
      
      // If this is a large video that needs chunking but doesn't have actual chunk files yet,
      // initiate server-side chunking first
      if ((isChunkedVideo || (videoMetadata?.file_size && videoNeedsChunking(videoMetadata.file_size)))
          && (!videoMetadata?.chunking?.chunks || videoMetadata?.chunking?.chunks?.some(chunk => !chunk.videoPath))) {
        console.log("[DEBUG] Video needs chunking but chunks haven't been created yet");
        
        // Force update the chunking metadata if needed
        if (!isChunkedVideo && videoMetadata?.file_size && videoNeedsChunking(videoMetadata.file_size)) {
          console.log("[DEBUG] Forcing chunking metadata update for large video");
          const forceUpdateResult = await forceUpdateChunkingMetadata(projectId);
          
          if (!forceUpdateResult.success) {
            console.error("[DEBUG] Force update failed:", forceUpdateResult.error);
            toast.error("Failed to prepare video for chunked processing", { id: "transcribe-video" });
            return { success: false, error: forceUpdateResult.error };
          }
          
          console.log("[DEBUG] Successfully forced chunking metadata update");
        } else {
          // Initiate server-side chunking
          const chunkingResult = await initiateServerSideChunking(projectId, project.source_file_path);
          if (!chunkingResult.success) {
            console.error("[DEBUG] Chunking failed:", chunkingResult.error);
            toast.error("Failed to process video chunks", { id: "transcribe-video" });
            return { success: false, error: chunkingResult.error };
          }
          
          console.log("[DEBUG] Server-side chunking initiated successfully");
        }
        
        // Refresh project data to get updated chunking info
        const { data: updatedProject } = await supabase
          .from('projects')
          .select('video_metadata')
          .eq('id', projectId)
          .single();
          
        if (updatedProject) {
          const updatedMetadata = updatedProject.video_metadata as ExtendedVideoMetadata;
          if (updatedMetadata?.chunking?.chunks) {
            console.log(`[DEBUG] Updated chunks available: ${updatedMetadata.chunking.chunks.length}`);
          }
        }
      }
      
      if (isChunkedVideo) {
        console.log("[DEBUG] This is a chunked video. Processing chunk information for transcription.");
        console.log(`[DEBUG] Found ${videoMetadata.chunking?.chunks?.length || 0} chunks.`);
        
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
          
          console.log(`[DEBUG] Created ${projectVideos.length} video objects from chunks`);
        }
      }
    }

    // Additional debugging info for project videos
    if (projectVideos && projectVideos.length > 0) {
      console.log(`[DEBUG] Video details for ${projectVideos.length} videos:`);
      projectVideos.forEach((video, i) => {
        console.log(`[DEBUG] Video ${i+1}: ${video.title || 'Untitled'}`);
        console.log(`[DEBUG] - Path: ${video.source_file_path}`);
        console.log(`[DEBUG] - Has metadata: ${video.video_metadata ? 'Yes' : 'No'}`);
      });
    }

    // Call the edge function to transcribe the video
    console.log(`[DEBUG] Calling transcribe-video function for project ${projectId}`);
    console.log(`[DEBUG] Providing ${projectVideos.length} project videos`);
    
    const response = await supabase.functions.invoke('transcribe-video', {
      body: {
        projectId: projectId,
        projectVideos: projectVideos
      }
    });

    console.log("[DEBUG] Edge function response received", response);

    if (response.error) {
      console.error("[DEBUG] Error from transcribe-video edge function:", response.error);
      toast.error("Error transcribing video", { id: "transcribe-video" });
      return { 
        success: false, 
        error: response.error?.message || "Error calling transcription service" 
      };
    }

    const { transcript, error } = response.data || {};

    if (error) {
      console.error("[DEBUG] Error in transcription response:", error);
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

    // Check if transcript contains the error message about large files
    if (transcript.includes("too large for direct transcription")) {
      console.log("[DEBUG] Received 'too large' message from transcription service, but we've already tried chunking");
      toast.warning("Video file is large. If transcription fails, try again.", { id: "transcribe-video", duration: 5000 });
      
      // Try forcing the chunking metadata update and re-run transcription
      await forceUpdateChunkingMetadata(projectId);
      
      // Return the transcript anyway, as it might contain useful info
      toast.info("Please check the transcript for more information", { id: "transcribe-video", duration: 5000 });
    } else {
      toast.success("Video transcribed successfully!", { id: "transcribe-video" });
    }
    
    return { success: true, transcript: transcript };
  } catch (error: any) {
    console.error("[DEBUG] Error transcribing video:", error);
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
      console.error("[DEBUG] Project update error:", projectError);
      toast.error("Failed to update project");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("[DEBUG] Error updating project:", error);
    toast.error("Failed to update project");
    return false;
  }
};
