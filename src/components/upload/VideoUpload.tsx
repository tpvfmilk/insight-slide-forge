import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDropzone } from 'react-dropzone';
import { FileVideo, UploadCloud } from 'lucide-react';
import { createProjectFromVideo } from "@/services/uploadService";
import { Progress } from "@/components/ui/progress";
import { useUploadProgress } from '@/hooks/useOperationProgress';

export function VideoUpload() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [contextPrompt, setContextPrompt] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  
  const { createProgressHandler } = useUploadProgress();
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
    }
  }, []);
  
  const {getRootProps, getInputProps, isDragActive} = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv']
    },
    maxFiles: 1
  });
  
  const handleUpload = async () => {
    if (!videoFile) {
      toast.error("Please select a video file");
      return;
    }
    
    if (!title) {
      toast.error("Please enter a project title");
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Create a progress handler that updates both the local state and the global progress
      const trackUploadProgress = (progress: number, stage?: string) => {
        setUploadProgress(progress);
        setUploadStage(stage || "");
        
        // Update the progress in our global system
        globalProgressHandler(progress, stage);
      };
      
      const globalProgressHandler = createProgressHandler(
        `Uploading ${videoFile?.name || 'video file'}`, 
        'upload'
      );
      
      const project = await createProjectFromVideo(
        videoFile,
        title,
        contextPrompt,
        false,
        [],
        null,
        trackUploadProgress
      );
      
      if (project) {
        toast.success("Video uploaded and project created successfully!");
        // Reset the form
        setVideoFile(null);
        setTitle("");
        setContextPrompt("");
        setUploadProgress(0);
        setUploadStage("");
      } else {
        toast.error("Failed to create project from video");
      }
    } catch (error: any) {
      console.error("Error uploading video:", error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">Upload Video</h2>
      
      <div {...getRootProps()} className="relative border-2 border-dashed rounded-md p-6 cursor-pointer bg-background hover:bg-accent/50 transition-colors">
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center text-center">
          <FileVideo className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-lg text-muted-foreground">
            {isDragActive ? "Drop the video here..." : `Drag 'n' drop a video file here, or click to select`}
          </p>
          {videoFile && (
            <p className="text-sm mt-2 text-muted-foreground">
              Selected file: {videoFile.name}
            </p>
          )}
        </div>
        
        {isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/75 backdrop-blur-sm">
            <p className="text-lg font-semibold text-muted-foreground mb-2">
              {uploadStage || "Uploading..."}
            </p>
            <Progress value={uploadProgress} className="w-64" />
          </div>
        )}
      </div>
      
      <div className="mt-6">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contextPrompt">Context Prompt</Label>
            <Textarea
              id="contextPrompt"
              placeholder="Add a context prompt to guide the AI"
              value={contextPrompt}
              onChange={(e) => setContextPrompt(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="w-full mt-6"
          onClick={handleUpload}
          disabled={isUploading || !videoFile}
        >
          {isUploading ? (
            <>
              <UploadCloud className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Create Project"
          )}
        </Button>
      </div>
    </div>
  );
}
