
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
import { extractAndChunkAudio, transcribeAudioChunks } from "@/services/audioExtractionService";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mic, AlertTriangle, FileAudio } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AudioChunkMetadata, chunkAudioFile, createActualAudioChunks, uploadAudioChunks } from "@/services/audioChunkingService";
import { useAudioProcessingWorkflow } from "@/hooks/useOperationProgress";
import { useProgress } from "@/context/ProgressContext";

// Maximum recommended file duration in seconds
const MAX_RECOMMENDED_DURATION = 60 * 60; // 60 minutes
// Maximum recommended file size in bytes
const MAX_RECOMMENDED_SIZE = 200 * 1024 * 1024; // 200 MB - increased threshold since we handle chunking

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
  const [audioChunks, setAudioChunks] = useState<AudioChunkMetadata[]>([]);
  const [chunkProgress, setChunkProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const { startAudioProcessingWorkflow } = useAudioProcessingWorkflow();
  const { getOperationById } = useProgress();

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
    // Check file size - show warning but don't block large files
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

  const extractAudioFromVideo = async (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // Create video and canvas elements
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      // Set up audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      
      // Handle video loaded metadata
      video.onloadedmetadata = () => {
        // Set video to start at beginning
        video.currentTime = 0;
        
        // Set up canvas size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Process video
        video.muted = false; // We need audio
        
        // Connect audio output to destination
        const audioSource = audioCtx.createMediaElementSource(video);
        audioSource.connect(dest);
        audioSource.connect(audioCtx.destination);
        
        // Create a media recorder
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(dest.stream);
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/mp3' });
          resolve(blob);
          
          // Clean up
          video.pause();
          video.src = '';
          URL.revokeObjectURL(video.src);
        };
        
        // Start recording and playing
        recorder.start();
        video.play().catch(error => {
          console.error("Error playing video:", error);
          recorder.stop();
          reject(error);
        });
        
        // Stop recording when video ends
        video.onended = () => {
          recorder.stop();
        };
        
        // Handle errors
        video.onerror = (error) => {
          console.error("Video error:", error);
          recorder.stop();
          reject(error);
        };
      };
      
      // Load the video
      video.src = URL.createObjectURL(videoFile);
      
      // Set a timeout in case the video doesn't load
      const timeout = setTimeout(() => {
        reject(new Error("Timeout extracting audio from video"));
      }, 60000); // 60 second timeout
      
      video.onended = () => {
        clearTimeout(timeout);
      };
    });
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
    
    // Create a workflow to track all the steps
    const workflow = startAudioProcessingWorkflow();
    
    try {
      // Step 0: Create an empty project first to get the project ID
      setProcessingStage("Creating project");
      const initialToastId = "create-project";
      toast.loading("Creating project...", { id: initialToastId });
      
      // Create an empty audio file as a placeholder
      const emptyAudioBlob = new Blob(["placeholder"], { type: "audio/mp3" });
      const emptyAudioFile = new File([emptyAudioBlob], "placeholder_audio.mp3", { type: "audio/mpeg" });
      
      // Create the project with minimal data
      const project = await createProjectFromVideo(
        emptyAudioFile, 
        title, 
        ""  // Pass empty string for contextPrompt
      );
      
      if (!project || !project.id) {
        throw new Error("Failed to create project");
      }
      
      toast.success("Project created", { id: initialToastId });
      
      // Step 1: Extract audio from video
      workflow.updateWorkflowProgress(1, 0, "Extracting audio from video...");
      setProcessingStage("Extracting audio from video");
      const audioToastId = "extract-audio";
      toast.loading("Extracting audio from video...", { id: audioToastId });
      
      const audioBlob = await extractAudioFromVideo(selectedFile);
      setExtractionProgress(20);
      workflow.completeWorkflowStep(1, true, "Audio extracted successfully");
      
      // Step 2: Chunk the audio file
      workflow.updateWorkflowProgress(2, 0, "Analyzing and chunking audio...");
      setProcessingStage("Chunking audio file");
      const chunkingToastId = "chunk-audio";
      toast.loading("Chunking audio file...", { id: chunkingToastId });
      
      // Get metadata for chunks
      const chunkingResult = await chunkAudioFile(
        audioBlob,
        60, // 60 second chunks
        20   // 20MB max chunk size
      );
      
      if (!chunkingResult.success || !chunkingResult.chunks.length) {
        throw new Error(chunkingResult.error || "Failed to chunk audio");
      }
      
      setExtractionProgress(40);
      setAudioChunks(chunkingResult.chunks);
      workflow.completeWorkflowStep(2, true, `Created ${chunkingResult.chunks.length} chunk definitions`);
      
      // Step 3: Create actual audio chunks
      workflow.updateWorkflowProgress(3, 0, `Creating ${chunkingResult.chunks.length} audio chunks...`);
      setProcessingStage("Creating audio chunks");
      toast.loading(`Creating ${chunkingResult.chunks.length} audio chunks...`, { id: chunkingToastId });
      
      const actualChunks = await createActualAudioChunks(
        audioBlob, 
        chunkingResult.chunks,
        (progress, current, total) => {
          setExtractionProgress(40 + (progress * 0.2)); // 40% to 60%
          setChunkProgress({current, total});
          workflow.updateWorkflowProgress(3, progress, 
            `Creating audio chunk ${current} of ${total} (${Math.round(progress)}%)`);
        }
      );
      
      if (!actualChunks.length) {
        throw new Error("Failed to create audio chunks");
      }
      
      setExtractionProgress(60);
      workflow.completeWorkflowStep(3, true, `Created ${actualChunks.length} audio chunks`);
      toast.success(`Successfully created ${actualChunks.length} audio chunks`, { id: chunkingToastId });
      
      // Step 4: Upload audio chunks
      workflow.updateWorkflowProgress(4, 0, `Uploading ${actualChunks.length} audio chunks...`);
      setProcessingStage("Uploading audio chunks");
      const uploadToastId = "upload-chunks";
      toast.loading(`Uploading ${actualChunks.length} audio chunks...`, { id: uploadToastId });
      
      const uploadedChunks = await uploadAudioChunks(
        project.id,
        actualChunks,
        (progress) => {
          setExtractionProgress(60 + (progress * 0.2)); // 60% to 80%
          workflow.updateWorkflowProgress(4, progress, 
            `Uploading audio chunks (${Math.round(progress)}%)`);
        }
      );
      
      if (!uploadedChunks.length) {
        throw new Error("Failed to upload audio chunks");
      }
      
      toast.success(`Successfully uploaded ${uploadedChunks.length} audio chunks`, { id: uploadToastId });
      workflow.completeWorkflowStep(4, true, `Uploaded ${uploadedChunks.length} audio chunks`);
      setExtractionProgress(80);
      
      // Step 5: Transcribe the audio chunks
      workflow.updateWorkflowProgress(5, 0, `Transcribing ${uploadedChunks.length} audio segments...`);
      setProcessingStage("Transcribing audio chunks");
      const transcribeToastId = "transcribe-audio";
      toast.loading(`Transcribing ${uploadedChunks.length} audio segments...`, { id: transcribeToastId });
      
      const transcriptionResult = await transcribeAudioChunks(
        project.id,
        uploadedChunks,
        (progress) => {
          setExtractionProgress(80 + (progress * 0.2)); // 80% to 100%
          workflow.updateWorkflowProgress(5, progress, 
            `Transcribing audio chunks (${Math.round(progress)}%)`);
        }
      );
      
      if (!transcriptionResult.success) {
        workflow.completeWorkflowStep(5, false, 
          `Failed to transcribe: ${transcriptionResult.error || "Unknown error"}`);
        toast.error(`Failed to transcribe audio: ${transcriptionResult.error || "Unknown error"}`, { id: transcribeToastId });
        setIsUploading(false);
        
        // Still navigate to the project so they can see the partial results
        navigate(`/projects/${project.id}`);
        return;
      }
      
      workflow.completeWorkflowStep(5, true, "Transcription completed successfully");
      toast.success("Transcription completed successfully", { id: transcribeToastId });
      setExtractionProgress(100);
      
      // Navigate to the project page
      navigate(`/projects/${project.id}`);
    } catch (error: any) {
      console.error("Error extracting transcription:", error);
      toast.error(`Failed to extract transcription: ${error.message || "Unknown error"}`);
      
      // Mark the current workflow step as failed
      const steps = [1, 2, 3, 4, 5];
      const runningStep = steps.find(step => {
        const opId = workflow.operationIds[step-1];
        return opId && getOperationById(opId)?.status === 'running';
      });
      
      if (runningStep) {
        workflow.completeWorkflowStep(runningStep, false, error.message);
      }
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
                  Audio will be extracted and processed in chunks for optimal transcription
                </p>
              </div>
              
              <FileUploader 
                onFilesSelected={handleFileSelected} 
                accept="video/*" 
                maxSize={500} // Increase max size since we handle chunking
                multiple={false} 
                className="w-full" 
                disabled={isUploading} 
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
        
        {showSizeWarning && (
          <Alert variant="warning" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              This file is quite large. Processing may take longer than expected, but our audio chunking system will handle it efficiently 
              by extracting the full audio and breaking it into smaller chunks for processing.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="speakerDetection" 
            checked={useSpeakerDetection} 
            onCheckedChange={checked => setUseSpeakerDetection(checked as boolean)} 
            disabled={isUploading} 
          />
          <Label htmlFor="speakerDetection">
            Use speaker detection and format transcript with line breaks
          </Label>
        </div>
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
          
          {chunkProgress.current > 0 && (
            <div className="text-xs text-muted-foreground">
              Processing chunk {chunkProgress.current} of {chunkProgress.total}
            </div>
          )}
          
          {audioChunks.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium mb-1">Audio processing:</p>
              <div className="flex items-center gap-1">
                <FileAudio className="h-3.5 w-3.5 text-blue-600" /> 
                <span className="text-xs">Full audio extracted</span>
              </div>
              <div className="flex items-center gap-1">
                <FileAudio className="h-3.5 w-3.5 text-green-600" /> 
                <span className="text-xs">{audioChunks.length} processing chunks created</span>
              </div>
            </div>
          )}
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
