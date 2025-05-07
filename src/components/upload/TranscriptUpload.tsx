
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Image, Loader2 } from "lucide-react";
import { createProjectFromTranscript, uploadFile } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContextPromptInput } from "./ContextPromptInput";
import { SliderControl } from "./SliderControl";

export const TranscriptUpload = () => {
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [slidesPerMinute, setSlidesPerMinute] = useState<number>(6);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  const handleTranscriptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transcriptText.trim()) {
      toast.error("Please enter transcript text");
      return;
    }
    
    try {
      setIsUploading(true);
      // Create project from transcript text with slides per minute
      const project = await createProjectFromTranscript(
        transcriptText, 
        undefined, // title parameter
        contextPrompt, // contextPrompt parameter
        imageFile, // optional image file
        slidesPerMinute // slides per minute
      );
      
      if (project) {
        toast.success("Transcript received. Processing...");
        navigate(`/projects/${project.id}`);
      }
    } catch (error) {
      toast.error("Failed to process transcript");
      console.error("Transcript processing error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    setIsUploading(true);
    
    try {
      setImageFile(file);
      
      // Create a preview URL for the image
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      toast.success("Image uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload image");
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleTranscriptSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="transcript-text" className="text-sm font-medium">
          Transcript Text
        </label>
        <Textarea 
          id="transcript-text"
          placeholder="Paste or type your transcript here..."
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          className="min-h-[200px]"
        />
      </div>
      
      <div className="space-y-4 mt-4">
        <SliderControl 
          value={slidesPerMinute}
          onChange={setSlidesPerMinute}
        />
        
        <ContextPromptInput 
          value={contextPrompt}
          onChange={setContextPrompt}
        />
      </div>
      
      {imagePreview && (
        <div className="relative mt-4 border rounded-md overflow-hidden">
          <img 
            src={imagePreview} 
            alt="Uploaded preview" 
            className="w-full max-h-64 object-contain" 
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={removeImage}
          >
            Remove
          </Button>
        </div>
      )}
      
      <div className="flex gap-4">
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="sr-only"
          accept="image/*"
        />
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1"
          onClick={handleFileButtonClick}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Image className="h-4 w-4 mr-2" />
          )}
          {imageFile ? "Change Image" : "Upload Image"}
        </Button>
        <Button type="submit" className="flex-1" disabled={isUploading}>
          <ArrowRight className="h-4 w-4 mr-2" />
          Process Transcript
        </Button>
      </div>
    </form>
  );
};
