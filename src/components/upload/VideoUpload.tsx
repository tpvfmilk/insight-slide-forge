
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileVideo, Upload, AlertTriangle, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { createProjectFromVideo } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContextPromptInput } from "./ContextPromptInput";
import { FileUploader } from "@/components/ui/file-uploader";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { videoNeedsChunking, MAX_CHUNK_SIZE_MB } from "@/services/videoChunkingService";
import { formatFileSize } from "@/utils/formatUtils";

export const VideoUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [isLargeFile, setIsLargeFile] = useState<boolean>(false);
  const navigate = useNavigate();
  
  // Set default title from filename when a file is selected
  useEffect(() => {
    if (videoFile) {
      const filename = videoFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
      if (!title) {
        setTitle(filename);
      }
      
      // Check if this is a large file that will need chunking
      const needsChunking = videoNeedsChunking(videoFile.size);
      setIsLargeFile(needsChunking);
    } else {
      setIsLargeFile(false);
    }
  }, [videoFile, title]);
  
  const handleFileSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0]; // Only use the first file
    
    // Check if the file is a video
    if (!file.type.startsWith('video/')) {
      toast.error(`${file.name} is not a valid video file`);
      return;
    }
    
    // Check file size (limit to 500MB)
    if (file.size > 500 * 1024 * 1024) {
      toast.error(`${file.name} is too large (max 500MB allowed)`);
      return;
    }
    
    setVideoFile(file);
  };
  
  const handleRemoveFile = () => {
    setVideoFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile) {
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
        const newProgress = prev + 5;
        if (newProgress >= 90) {
          clearInterval(interval);
          return 90;
        }
        return newProgress;
      });
    }, 300);
    
    try {
      console.log("Creating project from video file:", videoFile.name);
      
      // Display slightly different message for large files
      if (isLargeFile) {
        toast.loading("Uploading and preparing large video for chunked processing...", { id: "video-upload" });
      } else {
        toast.loading("Uploading video...", { id: "video-upload" });
      }
      
      // Create project from the single video file
      const project = await createProjectFromVideo(
        videoFile, 
        title, 
        contextPrompt,
        "" // No transcript
      );
      
      clearInterval(interval);
      setUploadProgress(100);
      toast.success("Upload complete!", { id: "video-upload" });
      
      setTimeout(() => {
        setIsUploading(false);
        
        if (project) {
          console.log("Project created successfully:", project.id);
          
          if (isLargeFile) {
            toast.info("Large video will be automatically processed in chunks for better transcription", { duration: 6000 });
          }
          
          toast.success("Redirecting to slide editor...");
          navigate(`/projects/${project.id}`);
        }
      }, 500);
    } catch (error) {
      clearInterval(interval);
      setIsUploading(false);
      toast.error("Failed to upload video", { id: "video-upload" });
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
              MP4 or WebM format, up to 500MB
            </p>
            
            <FileUploader
              onFilesSelected={handleFileSelected}
              selectedFiles={videoFile ? [videoFile] : []}
              onRemoveFile={handleRemoveFile}
              accept="video/*"
              maxSize={500}
              multiple={false}
              className="w-full"
              showPreview={true}
              disabled={isUploading}
            />
          </div>
        </div>
        
        {isLargeFile && videoFile && (
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Large Video File</AlertTitle>
            <AlertDescription>
              <p>This video ({formatFileSize(videoFile.size)}) is larger than {MAX_CHUNK_SIZE_MB}MB and will be automatically processed in chunks for optimal transcription.</p>
              <p className="mt-1">Each chunk will be transcribed separately and the results will be combined. The chunking process happens automatically when you click the "Re-Transcribe Video" button in the project settings.</p>
            </AlertDescription>
          </Alert>
        )}
        
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
            disabled={!videoFile || !title.trim()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Video
          </Button>
        </div>
      )}
    </form>
  );
};
