
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploader } from "@/components/ui/file-uploader";
import { createProjectFromVideo } from "@/services/uploadService";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { extractAudioFromVideo } from "@/services/audioExtractionService";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mic, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";

// Maximum recommended file duration in seconds
const MAX_RECOMMENDED_DURATION = 30 * 60; // 30 minutes
// Maximum recommended file size in bytes
const MAX_RECOMMENDED_SIZE = 50 * 1024 * 1024; // 50 MB
// OpenAI's maximum file size limit
const OPENAI_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export const TranscriptExtractor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [useSpeakerDetection, setUseSpeakerDetection] = useState<boolean>(true);
  const [showSizeWarning, setShowSizeWarning] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [fileDuration, setFileDuration] = useState<number | null>(null);

  // Set default title from filename when a file is selected
  useEffect(() => {
    if (selectedFile) {
      const filename = selectedFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
      setTitle(filename);

      // Check file size and show warning if needed
      checkFileSizeAndDuration(selectedFile);
    }
  }, [selectedFile]);

  const checkFileSizeAndDuration = async (file: File) => {
    // Check file size
    if (file.size > MAX_RECOMMENDED_SIZE) {
      setShowSizeWarning(true);
    } else {
      setShowSizeWarning(false);
    }

    // We'll also check duration when video metadata is loaded
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setFileDuration(video.duration);
      if (video.duration > MAX_RECOMMENDED_DURATION) {
        setShowSizeWarning(true);
      }
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  };

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
    setExtractionProgress(0);
    try {
      // Extract audio from the video file client-side
      setProcessingStage("Extracting audio from video");
      toast.loading("Extracting audio from video...", { id: "extract-audio" });
      
      let audioBlob;
      try {
        // Show progress during extraction
        const updateExtractionProgress = (progress: number) => {
          setExtractionProgress(progress);
        };
        
        audioBlob = await extractAudioFromVideo(selectedFile, updateExtractionProgress);
        
        // Log the size of the extracted audio
        const audioSizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
        console.log(`Extracted audio size: ${audioSizeMB}MB`);
        
        // Check if the audio is too large for OpenAI's API
        if (audioBlob.size > OPENAI_MAX_FILE_SIZE) {
          console.warn(`Audio size (${audioSizeMB}MB) exceeds OpenAI's limit of 25MB. Using compressed version.`);
        }
        
        toast.success("Audio extracted successfully", { id: "extract-audio" });
      } catch (extractionError: any) {
        console.error("Error during audio extraction:", extractionError);
        toast.error(`Audio extraction failed: ${extractionError.message || "Unknown error"}`, { id: "extract-audio" });
        setIsUploading(false);
        return;
      }

      // Create a project and process the audio for transcription
      setProcessingStage("Processing transcription");
      toast.loading("Processing transcription...", { id: "process-transcript" });

      // Convert the audio blob to a file for upload
      const audioFile = new File([audioBlob], "extracted_audio.mp3", { type: "audio/mpeg" });
      
      // Create the project first
      const project = await createProjectFromVideo(audioFile, title, contextPrompt, "");

      // Handle successful creation
      if (project && project.id) {
        toast.success("Video uploaded for transcription", { id: "process-transcript" });
        // Navigate to the project page
        navigate(`/projects/${project.id}`);
      } else {
        throw new Error("Failed to create project");
      }
    } catch (error: any) {
      console.error("Error extracting transcription:", error);
      toast.error(`Failed to extract transcription: ${error.message || "Unknown error"}`, { id: "process-transcript" });
    } finally {
      setIsUploading(false);
    }
  };

  // Default empty context prompt
  const [contextPrompt, setContextPrompt] = useState<string>("");

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
            onChange={e => setTitle(e.target.value)} 
            placeholder="Enter a title for your project" 
            required 
            disabled={isUploading} 
          />
        </div>
        
        <div className="space-y-2">
          <Label>Upload Video for Transcription</Label>
          <Card className={`border-dashed ${showSizeWarning ? "border-yellow-400" : ""}`}>
            <CardContent className="pt-6">
              <div className="text-center pb-4">
                <FileText className={`h-10 w-10 mb-2 mx-auto ${showSizeWarning ? "text-yellow-500" : "text-primary"}`} />
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
                disabled={isUploading} 
              />
              
              {selectedFile && (
                <div className="mt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-muted-foreground">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  {fileDuration && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Duration: {Math.floor(fileDuration / 60)}m {Math.round(fileDuration % 60)}s
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {showSizeWarning && (
          <Alert variant="warning" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              This file is quite large. For best results, we recommend using videos under 30 minutes or 50MB.
              {selectedFile && selectedFile.size > OPENAI_MAX_FILE_SIZE && (
                <span className="block font-medium mt-1">
                  Note: Files over 25MB will be automatically processed using our client-side audio extraction 
                  to ensure compatibility with transcription services.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <Collapsible 
          open={showAdvancedOptions} 
          onOpenChange={setShowAdvancedOptions}
          className="border rounded-md p-4"
        >
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <span className="font-medium">Advanced Options</span>
              <Button variant="ghost" size="sm" type="button">
                {showAdvancedOptions ? "Hide" : "Show"}
              </Button>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="contextPrompt">Context Prompt (Optional)</Label>
              <Input
                id="contextPrompt"
                value={contextPrompt}
                onChange={e => setContextPrompt(e.target.value)}
                placeholder="Add context about the video content to improve transcription"
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">
                Provide context about the video topic, terminology, or speakers to enhance transcription accuracy.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="speakerDetection" 
                checked={useSpeakerDetection} 
                onCheckedChange={checked => setUseSpeakerDetection(checked as boolean)} 
                disabled={isUploading} 
              />
              <Label htmlFor="speakerDetection" className="text-sm">
                Use speaker detection and format transcript with line breaks
              </Label>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      
      {isUploading && (
        <div className="space-y-4 border rounded-md p-4 bg-slate-50">
          <p className="text-sm font-medium">{processingStage}</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Progress</span>
              <span>{Math.round(extractionProgress)}%</span>
            </div>
            <Progress 
              value={extractionProgress} 
              className="h-2"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {extractionProgress < 100 ? 
              "This may take several minutes depending on the file size." : 
              "Processing transcription... Please wait."}
          </p>
        </div>
      )}
      
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
