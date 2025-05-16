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
import { processVideoForChunking } from "@/services/clientVideoChunkingService";
import { getUploadStageMessage } from "@/utils/uploadProgressUtils";

export const VideoUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>("Preparing...");
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [isLargeFile, setIsLargeFile] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
    
    // Clear any error messages when new file is selected
    setUploadError(null);
    
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
    console.log(`[DEBUG] Selected video file: ${file.name} (${formatFileSize(file.size)})`);
  };
  
  const handleRemoveFile = () => {
    setVideoFile(null);
    setUploadError(null);
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
    
    // Clear any previous errors
    setUploadError(null);
    
    // Start uploading
    setIsUploading(true);
    setUploadProgress(0);
    setProgressMessage("Preparing to upload...");
    
    try {
      console.log("[DEBUG] Processing video file:", videoFile.name);
      console.log(`[DEBUG] Video size: ${(videoFile.size / (1024 * 1024)).toFixed(2)} MB`);
      
      // Display slightly different message for large files
      const toastId = "video-upload";
      if (isLargeFile) {
        toast.loading("Processing and uploading large video file...", { id: toastId });
      } else {
        toast.loading("Uploading video...", { id: toastId });
      }
      
      // Video processing phase (0-20% of progress)
      const processResult = await processVideoForChunking(videoFile, (progress, message) => {
        // First 20% of progress is for processing
        setUploadProgress(Math.floor(progress * 0.2)); 
        setProgressMessage(message || "Processing video...");
        console.log(`[DEBUG] Processing progress: ${progress}% - ${message || "Processing"}`);
      });
      
      // If chunking was needed and successful, we'll upload the chunks
      if (processResult.needsChunking && processResult.chunkFiles.length > 0) {
        console.log(`[DEBUG] Video was chunked into ${processResult.chunkFiles.length} segments`);
        setProgressMessage(`Uploading ${processResult.chunkFiles.length} video chunks...`);
      } else {
        console.log("[DEBUG] Video will be uploaded as a single file");
        setProgressMessage("Uploading video file...");
      }
      
      // Create project from the processed video files (upload + project creation)
      // The progress callback will now receive accurate progress updates from uploadFileWithProgress
      const project = await createProjectFromVideo(
        processResult.originalFile, 
        title, 
        contextPrompt, 
        processResult.needsChunking,
        processResult.chunkFiles,
        processResult.chunkMetadata,
        (progress, stage) => {
          setUploadProgress(progress);
          
          // Use the utility function to generate user-friendly messages
          if (stage) {
            const message = getUploadStageMessage(stage, progress);
            setProgressMessage(message);
          }
          
          console.log(`[DEBUG] Upload progress: ${progress}%, Stage: ${stage || "uploading"}`);
        }
      );
      
      if (!project) {
        throw new Error("Failed to create project");
      }
      
      setUploadProgress(100);
      setProgressMessage("Upload complete!");
      toast.success("Upload complete!", { id: toastId });
      
      setTimeout(() => {
        setIsUploading(false);
        
        if (isLargeFile) {
          toast.message("Large video has been automatically processed in chunks for better transcription", { duration: 6000 });
        }
        
        toast.success("Redirecting to slide editor...");
        navigate(`/projects/${project.id}`);
      }, 500);
    } catch (error: any) {
      setIsUploading(false);
      const errorMessage = error?.message || "Unknown error";
      setUploadError(errorMessage);
      console.error("[DEBUG] Upload error:", error);
      toast.error("Failed to upload video", { id: "video-upload" });
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
        
        {uploadError && (
          <Alert variant="destructive" className="border-red-500">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Upload Error</AlertTitle>
            <AlertDescription>
              <div>{uploadError}</div>
              <div className="text-xs mt-2">
                Try refreshing the page or using a smaller video file (under 50MB).
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {isLargeFile && videoFile && !uploadError && (
          <Alert variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle>Large Video File</AlertTitle>
            <AlertDescription>
              <p>This video ({formatFileSize(videoFile.size)}) is larger than {MAX_CHUNK_SIZE_MB}MB and will be automatically processed in chunks for optimal transcription.</p>
              <p className="mt-1">Each chunk will be transcribed separately and the results will be combined.</p>
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
            <span>{progressMessage}</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress 
            value={uploadProgress}
            className="h-2"
            indicatorClassName={uploadProgress < 20 ? "bg-amber-500" : "bg-primary"} 
          />
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
