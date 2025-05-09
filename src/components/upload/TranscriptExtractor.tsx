
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploader } from "@/components/ui/file-uploader";
import { extractTranscriptionFromVideo } from "@/services/uploadService";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { extractAudioFromVideo } from "@/services/audioExtractionService";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mic, Upload } from "lucide-react";
import { SliderControl } from "@/components/upload/SliderControl";
import { ContextPromptInput } from "@/components/upload/ContextPromptInput";

export const TranscriptExtractor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [useSpeakerDetection, setUseSpeakerDetection] = useState<boolean>(true);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [slidesPerMinute, setSlidesPerMinute] = useState<number>(6);
  
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
        toast.error("Please select a video file.");
        return;
      }
      
      setSelectedFile(files[0]);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error("Please select a video file to extract transcription from.");
      return;
    }
    
    if (!title.trim()) {
      toast.error("Please enter a title for your project.");
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Extract audio from the video file client-side
      toast.loading("Extracting audio from video...", { id: "extract-audio" });
      const audioBlob = await extractAudioFromVideo(selectedFile);
      toast.success("Audio extracted successfully", { id: "extract-audio" });
      
      // Create a project and process the audio for transcription
      toast.loading("Processing transcription...", { id: "process-transcript" });
      
      const project = await extractTranscriptionFromVideo(
        audioBlob, 
        title, 
        useSpeakerDetection,
        contextPrompt,
        slidesPerMinute
      );
      
      toast.success("Transcription extracted successfully", { id: "process-transcript" });
      
      // Navigate to the project page
      if (project && project.id) {
        navigate(`/projects/${project.id}`);
      }
    } catch (error) {
      console.error("Error extracting transcription:", error);
      toast.error("Failed to extract transcription", { id: "process-transcript" });
    } finally {
      setIsUploading(false);
    }
  };
  
  if (!user) {
    return (
      <div className="text-center p-4 border rounded-md bg-muted">
        Please log in to extract transcription from videos.
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Project Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your project"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label>Upload Video for Transcription</Label>
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center pb-4">
                <FileText className="h-10 w-10 mb-2 text-primary mx-auto" />
                <p className="text-sm font-medium">Extract transcript from a video file</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Only the audio will be processed - the video won't be stored
                </p>
              </div>
              
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
            </CardContent>
          </Card>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="speakerDetection" 
            checked={useSpeakerDetection} 
            onCheckedChange={(checked) => setUseSpeakerDetection(checked as boolean)}
          />
          <Label htmlFor="speakerDetection">
            Use speaker detection and format transcript with line breaks
          </Label>
        </div>
        
        <div>
          <Label className="mb-2 block">Context for future slide generation (optional)</Label>
          <ContextPromptInput 
            value={contextPrompt}
            onChange={setContextPrompt}
          />
        </div>
        
        <div>
          <Label className="mb-2 block">Slides per minute for future generation</Label>
          <SliderControl 
            value={slidesPerMinute}
            onChange={setSlidesPerMinute}
          />
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button type="submit" disabled={isUploading || !selectedFile}>
          {isUploading ? (
            <>Processing...</>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Extract Transcript
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
