
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileVideo, Upload, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { createProjectFromVideo } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner"; // Updated import
import { ContextPromptInput } from "./ContextPromptInput";

export const CombinedUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [showDeveloperOptions, setShowDeveloperOptions] = useState<boolean>(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  const handleVideoButtonClick = () => {
    videoFileInputRef.current?.click();
  };
  
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
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
      // Create project from video, passing the transcript text
      // Make sure to pass false as default value for needsChunking
      const project = await createProjectFromVideo(
        videoFile, 
        videoFileName || "Video Project",
        contextPrompt,
        false // Pass boolean value for needsChunking
      );
      
      clearInterval(interval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        
        if (project) {
          toast.success("Upload complete! Redirecting to slide editor...");
          navigate(`/projects/${project.id}`);
        }
      }, 500);
    } catch (error) {
      clearInterval(interval);
      setIsUploading(false);
      toast.error("Failed to upload content");
      console.error("Upload error:", error);
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
          <Progress value={uploadProgress} />
        </div>
      ) : (
        <Button onClick={handleSubmit} className="w-full" disabled={!videoFile}>
          Process Combined Content
        </Button>
      )}
    </div>
  );
};
