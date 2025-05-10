
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

export const VideoUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [slidesPerMinute, setSlidesPerMinute] = useState<number>(6);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const navigate = useNavigate();
  
  // Set default title from filename when a file is selected
  useEffect(() => {
    if (selectedFile) {
      const filename = selectedFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
      setTitle(filename);
    }
  }, [selectedFile]);
  
  const handleFileSelected = (files: FileList | null) => {
    if (files && files[0]) {
      // Check if the file is a video
      if (!files[0].type.startsWith('video/')) {
        toast.error("Please upload a video file");
        return;
      }
      
      // Check file size (limit to 100MB)
      if (files[0].size > 100 * 1024 * 1024) {
        toast.error("File size must be less than 100MB");
        return;
      }
      
      setSelectedFile(files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error("Please select a video file");
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
      console.log("Creating project from video file:", selectedFile.name);
      
      // Perform the actual upload with slides per minute
      const project = await createProjectFromVideo(
        selectedFile, 
        title, 
        contextPrompt,
        "", // No transcript
        slidesPerMinute
      );
      
      // Now also add the video to project_videos table
      if (project && project.source_file_path) {
        try {
          // Add the main video to the project_videos table with display order 0
          await createProjectVideo({
            project_id: project.id,
            source_file_path: project.source_file_path,
            title: title || "Main Video",
            description: "Original project video",
            display_order: 0,
            video_metadata: project.video_metadata
          });
          console.log("Added main video to project_videos table");
        } catch (error) {
          console.error("Error adding main video to project_videos:", error);
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
          <Label>Upload Video</Label>
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
            <FileVideo className="h-8 w-8 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">Upload a video file</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              MP4 or WebM format, up to 100MB
            </p>
            
            <FileUploader
              onFilesSelected={handleFileSelected}
              accept="video/*"
              maxSize={100}
              multiple={false}
              className="w-full"
            />
            
            {selectedFile && (
              <div className="mt-4 text-sm text-center">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
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
          <Button type="submit" disabled={!selectedFile || !title.trim()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Video
          </Button>
        </div>
      )}
    </form>
  );
};
