
import { useState, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Project } from "@/services/projectService";
import { Upload, RefreshCw } from "lucide-react";
import { createProjectVideo, getNextDisplayOrder } from "@/services/projectVideoService";
import { supabase } from "@/integrations/supabase/client";

interface VideoUploaderProps {
  project: Project;
  onComplete: () => void;
  onCancel: () => void;
}

export const VideoUploader = ({
  project,
  onComplete,
  onCancel
}: VideoUploaderProps) => {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check if it's a video file
      if (!selectedFile.type.startsWith('video/')) {
        toast.error("Please select a valid video file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !project.id) {
      toast.error("Please select a video file to upload");
      return;
    }

    try {
      setUploading(true);
      
      // Get the next display order
      const nextDisplayOrder = await getNextDisplayOrder(project.id);

      // 1. Upload the file to storage
      const filePath = `project_videos/${project.id}/${Date.now()}_${file.name}`;
      
      // Create an XMLHttpRequest to track progress manually since Supabase doesn't support onUploadProgress
      const xhr = new XMLHttpRequest();
      
      // Create a Promise to handle the upload
      const uploadPromise = new Promise<{ path: string; error: Error | null }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            setUploadProgress(Math.round(percent));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });
        
        // Perform the actual upload using Supabase
        // This will set up the upload but won't use the XHR progress
        const uploadTask = async () => {
          const { data, error } = await supabase.storage
            .from('video_uploads')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
            });
            
          if (error) {
            reject(error);
          } else {
            resolve({ path: filePath, error: null });
            // Set progress to 100% when complete
            setUploadProgress(100);
          }
        };
        
        uploadTask();
      });

      // Wait for upload to complete
      const { error: uploadError } = await uploadPromise;

      if (uploadError) {
        throw uploadError;
      }

      // 2. Get video metadata
      const videoDuration = await getVideoDuration(file);
      
      const videoMetadata = {
        duration: videoDuration,
        original_file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      };
      
      // 3. Create the project video record
      await createProjectVideo({
        project_id: project.id,
        title: title || file.name,
        description,
        source_file_path: filePath,
        video_metadata: videoMetadata,
        display_order: nextDisplayOrder,
        extracted_frames: null, // Add the missing property
      });
      
      // 4. Also ensure the main project video is added to project_videos if it's not already there
      if (project.source_type === 'video' && project.source_file_path) {
        try {
          // Check if the source video is already in project_videos table
          const { data: existingVideos } = await supabase
            .from('project_videos')
            .select('id')
            .eq('project_id', project.id)
            .eq('source_file_path', project.source_file_path);
          
          // If main video isn't in project_videos table yet, add it
          if (!existingVideos || existingVideos.length === 0) {
            console.log("Adding main project video to project_videos table:", project.source_file_path);
            
            await createProjectVideo({
              project_id: project.id,
              title: "Main Project Video",
              description: "Primary video for this project", 
              source_file_path: project.source_file_path,
              video_metadata: project.video_metadata,
              display_order: 0, // Give it priority in ordering
              extracted_frames: project.extracted_frames
            });
          }
        } catch (error) {
          console.error("Error checking/adding main project video:", error);
          // Don't fail the entire operation if this fails
        }
      }
      
      toast.success("Video uploaded successfully");
      onComplete();
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error("Failed to upload video");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };
  
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        resolve(0); // Return 0 if we can't get the duration
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="video-upload" className="block text-sm font-medium mb-1">
          Video File
        </label>
        <div className="border-dashed border-2 rounded-lg p-6 flex flex-col items-center justify-center">
          {file ? (
            <div className="text-center">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => setFile(null)}
                size="sm"
              >
                Change File
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="mb-2">Drag & drop your video file here, or click to browse</p>
              <Input
                id="video-upload"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="max-w-xs"
              />
            </>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="video-title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <Input
          id="video-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={file ? file.name : "Video title"}
        />
      </div>

      <div>
        <label htmlFor="video-description" className="block text-sm font-medium mb-1">
          Description (optional)
        </label>
        <Textarea
          id="video-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter a description for this video"
          rows={3}
        />
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground text-right">
            {uploadProgress}%
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>
        <Button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Video
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
