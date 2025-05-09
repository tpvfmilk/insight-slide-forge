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
import { FileText, Mic, AlertTriangle } from "lucide-react";
import { SliderControl } from "@/components/upload/SliderControl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress"; // Added missing import for Progress component

// Maximum recommended file duration in seconds
const MAX_RECOMMENDED_DURATION = 30 * 60; // 30 minutes
// Maximum recommended file size in bytes
const MAX_RECOMMENDED_SIZE = 50 * 1024 * 1024; // 50 MB

export const TranscriptExtractor = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [useSpeakerDetection, setUseSpeakerDetection] = useState<boolean>(true);
  const [slidesPerMinute, setSlidesPerMinute] = useState<number>(6);
  const [showSizeWarning, setShowSizeWarning] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [processingStage, setProcessingStage] = useState<string>("");

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
      toast.loading("Extracting audio from video...", {
        id: "extract-audio"
      });
      let audioBlob;
      try {
        // Show progress during extraction
        const updateExtractionProgress = (progress: number) => {
          setExtractionProgress(progress);
        };
        audioBlob = await extractAudioFromVideo(selectedFile, updateExtractionProgress);
        toast.success("Audio extracted successfully", {
          id: "extract-audio"
        });
      } catch (extractionError) {
        console.error("Error during audio extraction:", extractionError);
        toast.error(`Audio extraction failed: ${extractionError.message || "Unknown error"}`, {
          id: "extract-audio"
        });
        setIsUploading(false);
        return;
      }

      // Check audio blob size
      if (audioBlob.size > 10 * 1024 * 1024) {
        // 10MB limit for edge function
        toast.warning("The extracted audio is quite large. Processing may take longer than expected.", {
          duration: 8000
        });
      }

      // Create a project and process the audio for transcription
      setProcessingStage("Processing transcription");
      toast.loading("Processing transcription...", {
        id: "process-transcript"
      });

      // Create the project first
      const project = await extractTranscriptionFromVideo(audioBlob, title, useSpeakerDetection, "",
      // No context prompt
      slidesPerMinute);

      // Handle successful creation
      if (project && project.id) {
        toast.success("Transcription extracted successfully", {
          id: "process-transcript"
        });
        // Navigate to the project page
        navigate(`/projects/${project.id}`);
      } else {
        throw new Error("Failed to create project");
      }
    } catch (error) {
      console.error("Error extracting transcription:", error);
      toast.error(`Failed to extract transcription: ${error.message || "Unknown error"}`, {
        id: "process-transcript"
      });
    } finally {
      setIsUploading(false);
    }
  };
  if (!user) {
    return <div className="text-center p-4 border rounded-md bg-muted">
        Please log in to extract transcription from videos.
      </div>;
  }
  return <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Project Title</Label>
          <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter a title for your project" required disabled={isUploading} />
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
              
              <FileUploader onFilesSelected={handleFileSelected} accept="video/*" maxSize={100} multiple={false} className="w-full" disabled={isUploading} />
              
              {selectedFile && <div className="mt-4 text-sm text-center">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>}
            </CardContent>
          </Card>
        </div>
        
        {showSizeWarning && <Alert variant="warning" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              This file is quite large. For best results, we recommend using videos under 30 minutes or 50MB.
              Processing may take longer than expected.
            </AlertDescription>
          </Alert>}
        
        <div className="flex items-center space-x-2">
          <Checkbox id="speakerDetection" checked={useSpeakerDetection} onCheckedChange={checked => setUseSpeakerDetection(checked as boolean)} disabled={isUploading} />
          <Label htmlFor="speakerDetection">
            Use speaker detection and format transcript with line breaks
          </Label>
        </div>
        
        
      </div>
      
      {isUploading && <div className="space-y-4 border rounded-md p-4 bg-slate-50">
          <p className="text-sm font-medium">{processingStage}</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Progress</span>
              <span>{Math.round(extractionProgress)}%</span>
            </div>
            <Progress value={extractionProgress} indicatorClassName={extractionProgress < 100 ? "bg-blue-500" : "bg-green-500"} />
          </div>
          <p className="text-xs text-muted-foreground">
            {extractionProgress < 100 ? "This may take several minutes depending on the file size." : "Processing transcription... Please wait."}
          </p>
        </div>}
      
      <div className="flex justify-end">
        <Button type="submit" disabled={isUploading || !selectedFile}>
          {isUploading ? <>Processing...</> : <>
              <Mic className="mr-2 h-4 w-4" />
              Extract Transcript
            </>}
        </Button>
      </div>
    </form>;
};