
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileVideo, Upload, RefreshCw, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { createProjectFromVideo } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContextPromptInput } from "./ContextPromptInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAudioChunking } from "@/context/AudioChunkingContext";

export const CombinedUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>("preparing");
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [showDeveloperOptions, setShowDeveloperOptions] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState<boolean>(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { prepareForChunkedProcessing } = useAudioChunking();
  
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
    
    // Check file size (limit to 500MB now that we have server-side processing)
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File size must be less than 500MB");
      return;
    }
    
    setVideoFile(file);
    setVideoFileName(file.name);
    
    // Calculate file size in MB for display
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    toast.success(`Video file selected: ${fileSizeMB}MB`);
    
    // Let user know if this is a large file that will be processed server-side
    if (file.size > 50 * 1024 * 1024) {
      toast.info("Large video detected. Server-side processing will be used for better performance.", { duration: 5000 });
    }
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
    setUploadStage("uploading");
    
    // Simulate progress while actual upload happens
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + 2; // Slower progress increments
        if (newProgress >= 80) { // Cap progress at 80% until actually complete
          clearInterval(interval);
          return 80;
        }
        return newProgress;
      });
    }, 1000); // Slower updates to avoid UI freezing
    
    try {
      console.log("[DEBUG] Starting video upload process");
      console.log(`[DEBUG] File size: ${(videoFile.size / (1024 * 1024)).toFixed(2)}MB`);
      
      // Determine if chunking is needed based on file size
      const needsChunking = videoFile.size > 50 * 1024 * 1024;
      console.log(`[DEBUG] Server-side chunking needed: ${needsChunking}`);
      
      // Create project from video, passing the transcript text and chunking flag
      const project = await createProjectFromVideo(
        videoFile, 
        videoFileName || "Video Project",
        contextPrompt,
        needsChunking, // Pass true if file is large
        [], // No chunk files for combined upload - server will handle chunking
        [], // No chunk metadata - server will generate
        (progress, stage) => {
          // Allow progress updates from the service
          if (stage) setUploadStage(stage);
          setUploadProgress(Math.min(95, progress)); // Cap at 95% until complete
          console.log(`[DEBUG] Upload progress update: ${progress}% (${stage || 'processing'})`);
        }
      );
      
      clearInterval(interval);
      setUploadProgress(100);
      setUploadStage("complete");
      
      if (!project) {
        throw new Error("Failed to create project after successful upload");
      }
      
      // If this is a large video that needs chunking, automatically start the audio extraction process
      if (needsChunking && project.source_file_path) {
        setUploadStage("processing_audio");
        setIsProcessingAudio(true);
        toast.loading("Video upload complete. Now preparing audio for processing...");
        
        // Start audio extraction and chunking process
        const success = await prepareForChunkedProcessing(project.id, project.source_file_path);
        
        if (success) {
          toast.success("Audio processing complete! Redirecting to project...");
        } else {
          toast.error("Audio processing was incomplete. You may need to try again from the project page.");
        }
        
        // Regardless of audio processing outcome, navigate to the project
        navigate(`/projects/${project.id}`);
      } else {
        // Standard small video case - just redirect
        toast.success("Upload complete! Redirecting to slide editor...");
        navigate(`/projects/${project.id}`);
      }
      
      setIsUploading(false);
    } catch (error: any) {
      clearInterval(interval);
      setIsUploading(false);
      setUploadStage("error");
      setIsProcessingAudio(false);
      
      let errorMessage = error?.message || "Failed to upload content";
      
      // Check for specific error types
      if (errorMessage.includes("chunking failed") || errorMessage.includes("video processing")) {
        errorMessage = "Video processing failed. The server might be busy or the video format is not supported.";
      } else if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
        errorMessage = "Network error. Please check your connection and try again with a smaller video.";
      }
      
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

  // Helper function to show a more human-readable status
  const getUploadStatusText = () => {
    switch (uploadStage) {
      case "uploading": return "Uploading video...";
      case "processing": return "Processing video...";
      case "chunking": return "Breaking video into manageable chunks...";
      case "analyzing": return "Analyzing video content...";
      case "finalizing": return "Finalizing project...";
      case "complete": return "Upload complete!";
      case "processing_audio": return "Processing audio for transcription...";
      default: return "Uploading...";
    }
  };

  return (
    <div className="space-y-6" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
        <FileVideo className="h-8 w-8 text-muted-foreground mb-4" />
        <h3 className="font-medium mb-1">Upload a video file</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          MP4 or WebM format, up to 500MB
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
          <Button onClick={handleVideoButtonClick} disabled={isUploading || isProcessingAudio}>
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
              Try refreshing the page or using a smaller/different video file. Large videos might take longer to process.
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
            disabled={isUploading || isProcessingAudio}
          />
        </div>
      </div>
      
      <div className="w-full">
        <ContextPromptInput 
          value={contextPrompt}
          onChange={setContextPrompt}
        />
      </div>
      
      {(isUploading || isProcessingAudio) ? (
        <div className="w-full mt-6 space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span>{getUploadStatusText()}</span>
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
