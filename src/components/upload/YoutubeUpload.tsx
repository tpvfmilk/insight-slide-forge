
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Youtube, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { createProjectFromUrl } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContextPromptInput } from "./ContextPromptInput";
import { SliderControl } from "./SliderControl";

export const YoutubeUpload = () => {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [slidesPerMinute, setSlidesPerMinute] = useState<number>(6);
  const navigate = useNavigate();

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoUrl) {
      toast.error("Please enter a YouTube or Vimeo URL");
      return;
    }
    
    if (!title.trim()) {
      toast.error("Please enter a title for your project");
      return;
    }
    
    // Simple validation for YouTube/Vimeo URLs
    const isValidUrl = videoUrl.includes('youtube.com') || 
                       videoUrl.includes('youtu.be') || 
                       videoUrl.includes('vimeo.com');
                       
    if (!isValidUrl) {
      toast.error("Please enter a valid YouTube or Vimeo URL");
      return;
    }
    
    // Start processing
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate progress while actual processing happens
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
      // Create project from URL with slides per minute
      const project = await createProjectFromUrl(
        videoUrl, 
        title, 
        contextPrompt,
        slidesPerMinute
      );
      
      clearInterval(interval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        
        if (project) {
          toast.success("URL processed successfully!");
          navigate(`/projects/${project.id}`);
        }
      }, 500);
    } catch (error) {
      clearInterval(interval);
      setIsUploading(false);
      toast.error("Failed to process video URL");
      console.error("Processing error:", error);
    }
  };

  return (
    <form onSubmit={handleYouTubeSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project-title" className="text-sm font-medium">
          Project Title
        </Label>
        <Input 
          id="project-title"
          placeholder="Enter a title for your project"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-2"
          required
          disabled={isUploading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="video-url" className="text-sm font-medium">
          YouTube or Vimeo URL
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="video-url"
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="pl-9"
              disabled={isUploading}
            />
          </div>
          <Button type="submit" disabled={isUploading}>
            {isUploading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Process
          </Button>
        </div>
      </div>

      <div className="space-y-4 mt-4">
        <div>
          <Label className="mb-2 block">Slides per minute</Label>
          <SliderControl 
            value={slidesPerMinute}
            onChange={setSlidesPerMinute}
          />
        </div>
        
        <div>
          <Label className="mb-2 block">Add series or content context (optional)</Label>
          <ContextPromptInput 
            value={contextPrompt}
            onChange={setContextPrompt}
          />
        </div>
      </div>
      
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span>Processing video...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}
    </form>
  );
};
