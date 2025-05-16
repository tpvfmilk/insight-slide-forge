
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseStoragePath } from "@/utils/videoPathUtils";
import { createProgressHandler, getUploadStageMessage } from "@/utils/uploadProgressUtils";
import { Json } from "@/integrations/supabase/types";
import { ExtendedVideoMetadata, ChunkingInfo, ChunkMetadata, toJsonSafe } from "@/types/videoChunking";

// Define Project type interface to fix the type errors
interface Project {
  id: string;
  title: string;
  context_prompt?: string;
  user_id: string;
  source_type: string;
  source_file_path?: string;
  video_metadata?: Json;
  transcript?: string;
  [key: string]: any;
}

/**
 * Creates a new project from an uploaded video file
 * @param videoFile The video file to upload
 * @param title The project title
 * @param contextPrompt Optional context prompt for the project
 * @param isChunkedVideo Whether the video has been processed as chunks
 * @param chunkFiles Optional array of video chunk files
 * @param chunkMetadata Optional metadata about the video chunks
 * @param onProgress Optional callback for upload progress updates
 * @returns The created project or null if failed
 */
export const createProjectFromVideo = async (
  videoFile: File,
  title: string,
  contextPrompt: string = "",
  isChunkedVideo: boolean = false,
  chunkFiles: File[] = [],
  chunkMetadata: any = null,
  onProgress?: (progress: number, stage?: string) => void
): Promise<Project | null> => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Create a unique filename to avoid conflicts
    const timestamp = Date.now();
    const originalFileName = videoFile.name;
    const fileExt = originalFileName.split('.').pop();
    const fileName = `${timestamp}_${originalFileName.replace(/\s+/g, '_')}`;
    const filePath = `${userId}/${fileName}`;
    
    // Prepare video metadata
    const videoMetadata: ExtendedVideoMetadata = {
      original_file_name: originalFileName,
      file_size: videoFile.size,
      file_type: videoFile.type,
      upload_timestamp: timestamp,
      duration: null // We'll try to extract this later
    };

    // If we're dealing with a chunked video, add chunking metadata
    if (isChunkedVideo && chunkMetadata) {
      videoMetadata.chunking = chunkMetadata as ChunkingInfo;
    }

    // Create progress handlers for different phases
    const uploadProgressHandler = createProgressHandler(
      (progress, stage) => {
        if (onProgress) {
          if (stage === "complete") {
            onProgress(90, "Creating project...");
          } else {
            onProgress(progress, stage || "Uploading video...");
          }
        }
      },
      20, // Upload starts at 20% of the overall process
      90  // Upload completes at 90% of the overall process
    );

    // Upload the video file with XMLHttpRequest to get real progress
    if (onProgress) onProgress(20, "Uploading video file...");
    
    let uploadedFilePath;
    
    if (videoFile.size > 0) {
      // Use XMLHttpRequest for real-time progress tracking
      const { path, error: uploadError } = await uploadFileWithProgress(
        videoFile, 
        filePath, 
        'video_uploads',
        uploadProgressHandler
      );
      
      if (uploadError) {
        throw new Error(`Error uploading video: ${uploadError.message}`);
      }
      
      uploadedFilePath = path;
    } else {
      // For empty files or special cases
      uploadedFilePath = filePath;
    }
    
    if (!uploadedFilePath) {
      throw new Error("Failed to get uploaded file path");
    }
    
    // Upload any chunked files if present
    if (isChunkedVideo && chunkFiles.length > 0) {
      if (onProgress) onProgress(60, "Uploading video chunks...");
      
      for (let i = 0; i < chunkFiles.length; i++) {
        const chunkFile = chunkFiles[i];
        if (!chunkFile) continue;
        
        const chunkProgress = createProgressHandler(
          (progress) => {
            if (onProgress) {
              const message = `Uploading chunk ${i + 1}/${chunkFiles.length}`;
              onProgress(progress, message);
            }
          },
          60 + (i * 30 / chunkFiles.length),    // Start progress
          60 + ((i + 1) * 30 / chunkFiles.length)  // End progress
        );
        
        // Get the chunk path from metadata
        const chunkPath = videoMetadata.chunking?.chunks?.[i]?.videoPath;
        if (!chunkPath) continue;
        
        const { bucketName, filePath } = parseStoragePath(chunkPath);
        
        await uploadFileWithProgress(
          chunkFile, 
          filePath, 
          bucketName,
          chunkProgress
        );
      }
    }
    
    if (onProgress) onProgress(90, "creating_project");

    // Create the project in the database
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        title,
        user_id: userId,  // Add the user_id field here
        source_type: 'video',
        source_file_path: uploadedFilePath,
        context_prompt: contextPrompt,
        video_metadata: toJsonSafe(videoMetadata), // Ensure metadata is JSON-safe
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (onProgress) onProgress(100, "complete");
    
    return project as Project;
  } catch (error) {
    console.error("Error creating project from video:", error);
    return null;
  }
};

/**
 * Uploads a file with real-time progress tracking using XMLHttpRequest
 * @param file The file to upload
 * @param filePath The path where to store the file
 * @param bucket The storage bucket name
 * @param onProgress Callback for progress updates
 * @returns Object with the uploaded file path or error
 */
export const uploadFileWithProgress = async (
  file: File,
  filePath: string,
  bucket: string = 'video_uploads',
  onProgress?: (progress: number, stage?: string) => void
): Promise<{ path?: string; error?: Error }> => {
  return new Promise((resolve) => {
    // Get file content as array buffer
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const fileContent = event.target?.result;
      if (!fileContent) {
        resolve({ error: new Error("Failed to read file content") });
        return;
      }

      // Create XMLHttpRequest for upload with progress tracking
      const xhr = new XMLHttpRequest();
      // Fix 1: Access the storage URL correctly using await
      const { data } = await supabase.storage.from(bucket).getPublicUrl(filePath);
      // Extract the base URL from the public URL to construct the upload endpoint
      const baseUrl = new URL(data.publicUrl).origin;
      const url = `${baseUrl}/storage/v1/object/${bucket}/${filePath}`;
      
      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const progressPercent = Math.round((event.loaded / event.total) * 100);
          onProgress(progressPercent, `uploading ${progressPercent}%`);
        }
      };
      
      // Handle completion
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Verify the file exists in storage
            const { data } = await supabase.storage
              .from(bucket)
              .getPublicUrl(filePath);
              
            if (!data) {
              resolve({ error: new Error("Failed to verify uploaded file") });
              return;
            }
            
            resolve({ path: filePath });
          } catch (verifyError) {
            resolve({ error: new Error(`Error verifying upload: ${verifyError.message}`) });
          }
        } else {
          resolve({ error: new Error(`Upload failed with status: ${xhr.status}`) });
        }
      };
      
      // Handle errors
      xhr.onerror = () => {
        resolve({ error: new Error("Network error during upload") });
      };
      
      xhr.onabort = () => {
        resolve({ error: new Error("Upload aborted") });
      };
      
      // Send the request
      xhr.open('POST', url);
      
      // Add authentication headers
      const { data: authData } = await supabase.auth.getSession();
      xhr.setRequestHeader('Authorization', `Bearer ${authData.session?.access_token}`);
      
      // Fix 2: Get the API key correctly
      const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      xhr.setRequestHeader('apikey', apiKey);
      
      // Set content type
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('x-upsert', 'true');
      
      // Send the file
      xhr.send(fileContent);
    };
    
    reader.onerror = () => {
      resolve({ error: new Error("Error reading file") });
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Transcribes a video using OpenAI's Whisper API via Supabase Edge Function
 * @param projectId The project ID to transcribe
 * @param projectVideos Optional array of video objects (for multi-video projects)
 * @param isTranscriptOnly Whether this is a text-only project without video
 * @param audioData Optional audio data if already extracted
 * @returns The transcription result
 */
export const transcribeVideo = async (
  projectId: string,
  projectVideos: any[] = [],
  isTranscriptOnly: boolean = false,
  audioData: string | null = null
) => {
  try {
    // Call the transcribe-video Edge Function
    const { data, error } = await supabase.functions.invoke("transcribe-video", {
      body: {
        projectId,
        projectVideos,
        isTranscriptOnly,
        audioData,
        // Add a parameter to enable speaker detection
        useSpeakerDetection: true,
        // Add a retry flag to signal this is a retry attempt
        isRetry: true
      },
    });

    if (error) {
      console.error("Transcription error:", error);
      return { 
        success: false, 
        error: `Transcription failed: ${error.message || "Unknown error"}`,
        transcript: null 
      };
    }

    if (!data || !data.transcript) {
      return { 
        success: false, 
        error: "No transcript was generated", 
        transcript: null 
      };
    }

    return { 
      success: true, 
      transcript: data.transcript, 
      needsChunking: data.needsChunking || false 
    };
  } catch (error) {
    console.error("Error in transcribeVideo:", error);
    return { 
      success: false, 
      error: `Transcription failed: ${error.message || "Unknown error"}`,
      transcript: null
    };
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
