
import { useState, ChangeEvent, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Project } from "@/services/projectService";
import { Upload, RefreshCw, X, ArrowUp, ArrowDown, Move } from "lucide-react";
import { createProjectVideo, getNextDisplayOrder } from "@/services/projectVideoService";
import { supabase } from "@/integrations/supabase/client";
import { FileUploader } from "@/components/ui/file-uploader";
import { Progress } from "@/components/ui/progress";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface VideoUploaderProps {
  project: Project;
  onComplete: () => void;
  onCancel: () => void;
}

interface VideoFile {
  file: File;
  title: string;
  description: string;
  uploadProgress: number;
  uploading: boolean;
  error: string | null;
}

export const VideoUploader = ({
  project,
  onComplete,
  onCancel
}: VideoUploaderProps) => {
  const [videoFiles, setVideoFiles] = useState<VideoFile[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [overallProgress, setOverallProgress] = useState<number>(0);

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    // Convert FileList to array and filter for video files
    const newFiles: VideoFile[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      
      // Check if it's a video file
      if (!file.type.startsWith('video/')) {
        toast.error(`${file.name} is not a valid video file`);
        continue;
      }
      
      // Add to our videos array
      newFiles.push({
        file,
        title: file.name, // Default title is filename
        description: "",
        uploadProgress: 0,
        uploading: false,
        error: null
      });
    }
    
    if (newFiles.length > 0) {
      setVideoFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setVideoFiles(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const updateVideoField = (index: number, field: keyof VideoFile, value: string) => {
    setVideoFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
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

  const uploadVideo = async (videoFile: VideoFile, index: number, displayOrder: number): Promise<boolean> => {
    try {
      // Update state to show we're uploading this file
      setVideoFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], uploading: true, error: null };
        return updated;
      });
      
      // 1. Upload the file to storage
      const filePath = `project_videos/${project.id}/${Date.now()}_${videoFile.file.name}`;
      
      // Create an XMLHttpRequest to track progress manually
      const xhr = new XMLHttpRequest();
      
      // Create a Promise to handle the upload
      const uploadPromise = new Promise<{ path: string; error: Error | null }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            // Update progress for this specific file
            setVideoFiles(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], uploadProgress: Math.round(percent) };
              return updated;
            });
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });
        
        // Perform the actual upload using Supabase
        const uploadTask = async () => {
          const { data, error } = await supabase.storage
            .from('video_uploads')
            .upload(filePath, videoFile.file, {
              cacheControl: '3600',
              upsert: false,
            });
            
          if (error) {
            reject(error);
          } else {
            resolve({ path: filePath, error: null });
            // Set progress to 100% when complete
            setVideoFiles(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], uploadProgress: 100 };
              return updated;
            });
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
      const videoDuration = await getVideoDuration(videoFile.file);
      
      const videoMetadata = {
        duration: videoDuration,
        original_file_name: videoFile.file.name,
        file_type: videoFile.file.type,
        file_size: videoFile.file.size,
      };
      
      // 3. Create the project video record
      await createProjectVideo({
        project_id: project.id,
        title: videoFile.title || videoFile.file.name,
        description: videoFile.description,
        source_file_path: filePath,
        video_metadata: videoMetadata,
        display_order: displayOrder,
        extracted_frames: null,
      });
      
      // Update state to indicate successful upload
      setVideoFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], uploading: false };
        return updated;
      });
      
      return true;
    } catch (error) {
      console.error("Error uploading video:", error);
      
      // Update state to indicate error
      setVideoFiles(prev => {
        const updated = [...prev];
        updated[index] = { 
          ...updated[index], 
          uploading: false, 
          error: error instanceof Error ? error.message : "Upload failed" 
        };
        return updated;
      });
      
      return false;
    }
  };

  const handleUploadAll = async () => {
    if (videoFiles.length === 0) {
      toast.error("Please select at least one video file to upload");
      return;
    }

    setIsUploading(true);
    setOverallProgress(0);
    
    try {
      // Get the next display order from the backend
      let nextDisplayOrder = await getNextDisplayOrder(project.id);
      let successCount = 0;
      let failCount = 0;
      
      // Process each video in the order shown in UI
      for (let i = 0; i < videoFiles.length; i++) {
        // Update overall progress
        setOverallProgress(Math.round((i / videoFiles.length) * 100));
        
        // Upload this video
        const success = await uploadVideo(videoFiles[i], i, nextDisplayOrder + i);
        
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      // Complete with appropriate message
      setOverallProgress(100);
      
      if (failCount === 0) {
        toast.success(`Successfully uploaded ${successCount} video${successCount !== 1 ? 's' : ''}`);
        onComplete();
      } else if (successCount > 0) {
        toast.info(`Uploaded ${successCount} video${successCount !== 1 ? 's' : ''}, but ${failCount} failed. You may try uploading the failed videos again.`);
      } else {
        toast.error("Failed to upload videos. Please try again.");
      }
    } catch (error) {
      console.error("Error in batch upload:", error);
      toast.error("Failed to complete uploads");
    } finally {
      setIsUploading(false);
      setOverallProgress(0);
    }
  };

  const handleDragEnd = useCallback(result => {
    // Dropped outside the list
    if (!result.destination) return;
    
    // Reorder the array
    const items = Array.from(videoFiles);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setVideoFiles(items);
  }, [videoFiles]);

  return (
    <div className="space-y-4">
      {/* File selection section */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Select Video Files
        </label>
        <FileUploader
          onFilesSelected={handleFilesSelected}
          selectedFiles={videoFiles.map(vf => vf.file)}
          onRemoveFile={handleRemoveFile}
          accept="video/*"
          multiple={true}
          showPreview={false}
          disabled={isUploading}
        />
      </div>
      
      {/* Sortable videos list */}
      {videoFiles.length > 0 && (
        <div className="space-y-2 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Video Files ({videoFiles.length})</h3>
            <p className="text-xs text-muted-foreground">Drag to reorder videos</p>
          </div>
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="videos">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2 max-h-[300px] overflow-y-auto"
                >
                  {videoFiles.map((video, index) => (
                    <Draggable
                      key={`${video.file.name}-${index}`}
                      draggableId={`${video.file.name}-${index}`}
                      index={index}
                      isDragDisabled={isUploading}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`border rounded-lg p-3 bg-background ${
                            snapshot.isDragging ? "shadow-lg" : ""
                          } ${video.error ? "border-red-300" : ""}`}
                          style={{
                            ...provided.draggableProps.style,
                            height: snapshot.isDragging ? provided.draggableProps.style?.height : 'auto'
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Drag handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="flex items-center justify-center mt-2 text-muted-foreground cursor-grab active:cursor-grabbing"
                            >
                              <Move className="h-5 w-5" />
                            </div>
                            
                            {/* Video details */}
                            <div className="flex-1 min-w-0">
                              <div className="space-y-2">
                                <Input
                                  value={video.title}
                                  onChange={(e) => updateVideoField(index, "title", e.target.value)}
                                  placeholder="Video title"
                                  disabled={isUploading}
                                  className="w-full"
                                />
                                
                                <Textarea
                                  value={video.description}
                                  onChange={(e) => updateVideoField(index, "description", e.target.value)}
                                  placeholder="Description (optional)"
                                  rows={2}
                                  disabled={isUploading}
                                  className="w-full text-sm resize-none"
                                />
                                
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{(video.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                </div>
                                
                                {/* Upload progress */}
                                {video.uploading && (
                                  <div className="space-y-1">
                                    <Progress value={video.uploadProgress} className="h-1" />
                                    <div className="text-xs text-right">{video.uploadProgress}%</div>
                                  </div>
                                )}
                                
                                {/* Error message */}
                                {video.error && (
                                  <p className="text-xs text-red-500">{video.error}</p>
                                )}
                              </div>
                            </div>
                            
                            {/* Remove button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFile(index)}
                              disabled={isUploading}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      {/* Overall upload progress */}
      {isUploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Uploading videos...</span>
            <span>{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isUploading}>
          Cancel
        </Button>
        <Button onClick={handleUploadAll} disabled={videoFiles.length === 0 || isUploading}>
          {isUploading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload {videoFiles.length > 1 ? `${videoFiles.length} Videos` : 'Video'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
