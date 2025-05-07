
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileVideo, Upload, RefreshCw, FileText, Image } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { createProjectFromVideo } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContextPromptInput } from "./ContextPromptInput";

export const CombinedUpload = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  const handleVideoButtonClick = () => {
    videoFileInputRef.current?.click();
  };

  const handleImageButtonClick = () => {
    imageFileInputRef.current?.click();
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

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // Check file type
    if (!file.type.includes('image/')) {
      toast.error("Please upload an image file");
      return;
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }
    
    setImageFile(file);
    
    // Create a preview URL for the image
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    toast.success("Caption image uploaded successfully");
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
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
      // Create project from video, passing the image file for OCR processing
      const project = await createProjectFromVideo(
        videoFile, 
        undefined, 
        contextPrompt,
        transcriptText, // Pass the transcript text
        imageFile      // Pass the image file for OCR
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

  return (
    <div className="space-y-6">
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

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="transcript-text" className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
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

        <div className="space-y-2">
          <label htmlFor="caption-image" className="text-sm font-medium flex items-center gap-2">
            <Image className="h-4 w-4" />
            Caption Image for OCR (optional)
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Upload an image of captions or subtitles to extract text using OCR
          </p>

          <input 
            type="file"
            id="caption-image"
            ref={imageFileInputRef}
            onChange={handleImageFileChange}
            className="sr-only"
            accept="image/*"
          />

          {imagePreview && (
            <div className="relative mt-4 border rounded-md overflow-hidden">
              <img 
                src={imagePreview} 
                alt="Caption preview" 
                className="w-full max-h-64 object-contain" 
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={removeImage}
                disabled={isUploading}
              >
                Remove
              </Button>
            </div>
          )}

          <Button 
            type="button" 
            variant="outline" 
            onClick={handleImageButtonClick}
            disabled={isUploading}
            className="w-full"
          >
            <Image className="h-4 w-4 mr-2" />
            {imageFile ? "Change Caption Image" : "Upload Caption Image"}
          </Button>
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
