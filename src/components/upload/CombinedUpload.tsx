
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileVideo, Upload, RefreshCw, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { createProjectFromVideo } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner"; // Updated import
import { ContextPromptInput } from "./ContextPromptInput";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const CombinedUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [showDeveloperOptions, setShowDeveloperOptions] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  const handleVideoButtonClick = () => {
    videoFileInputRef.current?.click();
  };
  
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // Clear any previous errors
    setUploadError(null);
    
    // Check file type
    if (!file.type.includes('video/')) {
      toast.error("Please upload a video file");
      return;
    }
    
    // Check file size (limit to 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be less than 100MB");
      return;
    }
    
    setVideoFile(file);
    setVideoFileName(file.name);
    toast.success("Video file selected successfully");
  };

  const handleSubmit = async () => {
    if (!videoFile) {
      toast.error("Please select a video file");
      return;
    }
    
    // Clear any previous errors
    setUploadError(null);
    
    // Start uploading
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate progress while actual upload happens
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + 3; // Slower progress increments
        if (newProgress >= 80) { // Cap progress at 80% until actually complete
          clearInterval(interval);
          return 80;
        }
        return newProgress;
      });
    }, 800); // Slower updates to avoid UI freezing
    
    try {
      console.log("[DEBUG] Starting video upload process");
      
      // Create project from video, passing the transcript text
      // Pass false as default value for needsChunking
      const project = await createProjectFromVideo(
        videoFile, 
        videoFileName || "Video Project",
        contextPrompt,
        false, // Explicitly pass boolean value for needsChunking
        [], // No chunk files for CombinedUpload
        [], // No chunk metadata for CombinedUpload
        (progress) => {
          // Allow progress updates from the service
          setUploadProgress(Math.min(90, progress)); // Cap at 90% until complete
          console.log(`[DEBUG] Upload progress update: ${progress}%`);
        }
      );
      
      clearInterval(interval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        
        if (project) {
          toast.success("Upload complete! Redirecting to slide editor...");
          navigate(`/projects/${project.id}`);
        } else {
          setUploadError("Failed to create project after successful upload");
        }
      }, 500);
    } catch (error: any) {
      clearInterval(interval);
      setIsUploading(false);
      const errorMessage = error?.message || "Failed to upload content";
      setUploadError(errorMessage);
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${errorMessage}`);
    }
  };
  
  // Toggle developer options with a secret key combination (Shift+Alt+D)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.shiftKey && e.altKey && e.key === 'D') {
      setShowDeveloperOptions(!showDeveloperOptions);
      toast.success(showDeveloperOptions ? "Developer options disabled" : "Developer options enabled");
    }
  };

  return (
    <div className="space-y-6" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
        <FileVideo className="h-8 w-8 text-muted-foreground mb-4" />
        <h3 className="font-medium mb-1">Upload a video file</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          MP4 or WebM format, up to 100MB
        </p>
        
        <input 
          type="file" 
          ref={videoFileInputRef}
          onChange={handleVideoFileChange}
          className="sr-only" 
          accept="video/*"
        />
        
        {videoFileName ? (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium">{videoFileName}</span>
            <Button size="sm" variant="outline" onClick={handleVideoButtonClick}>
              Change
            </Button>
          </div>
        ) : (
          <Button onClick={handleVideoButtonClick} disabled={isUploading}>
            <Upload className="h-4 w-4 mr-2" />
            Choose Video File
          </Button>
        )}
      </div>

      {uploadError && (
        <Alert variant="destructive" className="border-red-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Upload error:</div>
            <div className="text-sm mt-1">{uploadError}</div>
            <div className="text-xs mt-2">
              Try refreshing the page or using a smaller video file (under 50MB).
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="p-4 border rounded-lg bg-muted/20">
        <p className="text-sm text-muted-foreground mb-2">
          Slide count will be intelligently determined based on video content
        </p>
      </div>

      {/* Developer Options - hidden by default */}
      {showDeveloperOptions && (
        <div className="p-4 border border-amber-300 rounded-lg bg-amber-50 dark:bg-amber-950/20">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <span className="bg-amber-200 dark:bg-amber-800 px-1 text-xs rounded">DEV</span>
            Developer Options
          </h3>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="transcript-text" className="text-sm font-medium flex items-center gap-2">
            <FileVideo className="h-4 w-4" />
            Additional Transcript (optional)
          </label>
          <Textarea 
            id="transcript-text"
            placeholder="Paste or type additional transcript text here to enhance slide generation..."
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            className="min-h-[120px]"
            disabled={isUploading}
          />
        </div>
      </div>
      
      <div className="w-full">
        <ContextPromptInput 
          value={contextPrompt}
          onChange={setContextPrompt}
        />
      </div>
      
      {isUploading ? (
        <div className="w-full mt-6 space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress 
            value={uploadProgress} 
            indicatorClassName={uploadProgress < 20 ? "bg-amber-500" : "bg-primary"}
          />
        </div>
      ) : (
        <Button onClick={handleSubmit} className="w-full" disabled={!videoFile}>
          Process Combined Content
        </Button>
      )}
    </div>
  );
};
