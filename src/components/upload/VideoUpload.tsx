import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileVideo, Upload, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { createProjectFromVideo } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContextPromptInput } from "./ContextPromptInput";
import { SliderControl } from "./SliderControl";
import { FileUploader } from "@/components/ui/file-uploader";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createProjectVideo } from "@/services/projectVideoService";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";

interface VideoFileWithDetails {
  file: File;
  title: string;
}

export const VideoUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [slidesPerMinute, setSlidesPerMinute] = useState<number>(6);
  const [videoFiles, setVideoFiles] = useState<VideoFileWithDetails[]>([]);
  const [title, setTitle] = useState<string>("");
  const navigate = useNavigate();
  
  // Set default title from filename when a file is selected
  useEffect(() => {
    if (videoFiles.length === 1) {
      const filename = videoFiles[0].file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      if (!title) {
        setTitle(filename);
      }
    }
  }, [videoFiles]);
  
  const handleFileSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // Check each file
    const validFiles: VideoFileWithDetails[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check if the file is a video
      if (!file.type.startsWith('video/')) {
        toast.error(`${file.name} is not a valid video file`);
        continue;
      }
      
      // Check file size (limit to 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 100MB allowed)`);
        continue;
      }
      
      validFiles.push({
        file,
        title: file.name.replace(/\.[^/.]+$/, "") // Default title from filename without extension
      });
    }
    
    if (validFiles.length > 0) {
      setVideoFiles(prev => [...prev, ...validFiles]);
    }
  };
  
  const handleRemoveFile = (index: number) => {
    setVideoFiles(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };
  
  // Handle video title change
  const updateVideoTitle = (index: number, newTitle: string) => {
    setVideoFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], title: newTitle };
      return updated;
    });
  };
  
  // Handle reordering videos
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(videoFiles);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setVideoFiles(items);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (videoFiles.length === 0) {
      toast.error("Please select at least one video file");
      return;
    }
    
    if (!title.trim()) {
      toast.error("Please enter a title for your project");
      return;
    }
    
    // Start uploading
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate progress while actual upload happens
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + 10;
        if (newProgress >= 90) {
          clearInterval(interval);
          return 90;
        }
        return newProgress;
      });
    }, 300);
    
    try {
      console.log("Creating project from video file:", videoFiles[0].file.name);
      
      // Currently, we still only use the first video for main project creation
      // This is to maintain backward compatibility with the existing project structure
      const project = await createProjectFromVideo(
        videoFiles[0].file, 
        title, 
        contextPrompt,
        "", // No transcript
        slidesPerMinute
      );
      
      // Now add all videos to project_videos table
      if (project && project.id) {
        try {
          // First add the main video to the project_videos table with display order 0
          await createProjectVideo({
            project_id: project.id,
            source_file_path: project.source_file_path || '',
            title: videoFiles[0].title || "Main Video",
            description: "Original project video",
            display_order: 0,
            video_metadata: project.video_metadata,
            extracted_frames: null
          });
          
          console.log("Added main video to project_videos table");
          
          // Then add any additional videos with incrementing display orders
          for (let i = 1; i < videoFiles.length; i++) {
            const videoFile = videoFiles[i];
            
            // Upload the additional video
            const filePath = `project_videos/${project.id}/${Date.now()}_${videoFile.file.name}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('video_uploads')
              .upload(filePath, videoFile.file, {
                cacheControl: '3600',
                upsert: false,
              });
              
            if (uploadError) {
              console.error(`Error uploading additional video ${i}:`, uploadError);
              continue;
            }
            
            // Create a simple video metadata object
            const videoMetadata = {
              original_file_name: videoFile.file.name,
              file_type: videoFile.file.type,
              file_size: videoFile.file.size,
            };
            
            // Add to project_videos
            await createProjectVideo({
              project_id: project.id,
              source_file_path: filePath,
              title: videoFile.title || videoFile.file.name,
              description: `Additional project video ${i}`,
              display_order: i,
              video_metadata: videoMetadata,
              extracted_frames: null
            });
            
            console.log(`Added additional video ${i} to project_videos table`);
          }
        } catch (error) {
          console.error("Error adding videos to project_videos:", error);
          // Don't throw here, we'll still proceed with the project
        }
      }
      
      clearInterval(interval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        
        if (project) {
          console.log("Project created successfully:", project.id);
          toast.success("Upload complete! Redirecting to slide editor...");
          navigate(`/projects/${project.id}`);
        }
      }, 500);
    } catch (error) {
      clearInterval(interval);
      setIsUploading(false);
      toast.error("Failed to upload video");
      console.error("Upload error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="video-title">Project Title</Label>
          <Input
            id="video-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your project"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Upload Videos</Label>
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
            <FileVideo className="h-8 w-8 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">Upload video files</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              MP4 or WebM format, up to 100MB each
            </p>
            
            <FileUploader
              onFilesSelected={handleFileSelected}
              selectedFiles={videoFiles.map(vf => vf.file)}
              onRemoveFile={handleRemoveFile}
              accept="video/*"
              maxSize={100}
              multiple={true}
              className="w-full"
              showPreview={false}
              disabled={isUploading}
            />
            
            {videoFiles.length > 0 && (
              <div className="w-full mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium">Selected Videos ({videoFiles.length})</h4>
                  <p className="text-xs text-muted-foreground">Drag to reorder</p>
                </div>
                
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="video-files">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2 max-h-[240px] overflow-y-auto rounded-md border p-2"
                      >
                        {videoFiles.map((videoFile, index) => (
                          <Draggable
                            key={`${videoFile.file.name}-${index}`}
                            draggableId={`${videoFile.file.name}-${index}`}
                            index={index}
                            isDragDisabled={isUploading}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                  ...provided.draggableProps.style
                                }}
                                className={`flex items-center gap-2 p-2 rounded-md ${
                                  snapshot.isDragging ? "bg-accent shadow-md" : "bg-background"
                                }`}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-muted-foreground cursor-grab active:cursor-grabbing"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-move"><path d="m5 9-3 3 3 3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m9 5-3 3 3 3"/><path d="m15 5 3 3-3 3"/><path d="M12 2v20"/></svg>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <input
                                    type="text"
                                    value={videoFile.title}
                                    onChange={(e) => updateVideoTitle(index, e.target.value)}
                                    className="w-full text-sm border-none bg-transparent p-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    placeholder="Video title"
                                    disabled={isUploading}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    {(videoFile.file.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                </div>
                                
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full"
                                  onClick={() => handleRemoveFile(index)}
                                  disabled={isUploading}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </Button>
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
          </div>
        </div>

        <div className="space-y-2">
          <Label className="mb-2 block">Slides per minute</Label>
          <SliderControl 
            value={slidesPerMinute}
            onChange={setSlidesPerMinute}
          />
        </div>
        
        <div className="space-y-2">
          <Label className="mb-2 block">Add series or content context (optional)</Label>
          <ContextPromptInput 
            value={contextPrompt}
            onChange={setContextPrompt}
          />
        </div>
      </div>
      
      {isUploading ? (
        <div className="w-full mt-6 space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      ) : (
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={videoFiles.length === 0 || !title.trim()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload {videoFiles.length > 1 ? `${videoFiles.length} Videos` : 'Video'}
          </Button>
        </div>
      )}
    </form>
  );
};
