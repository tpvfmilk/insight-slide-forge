
import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { transcribeVideo } from "@/services/uploadService"
import { useProcessingProgress } from '@/hooks/useOperationProgress'
import { ChunkedProcessingAlert } from './ChunkedProcessingAlert'
import { ExtendedVideoMetadata } from "@/types/videoChunking"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TranscriptDialogProps {
  project: any;
  transcript: string;
  setTranscript: (transcript: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TranscriptDialog({
  project,
  transcript,
  setTranscript,
  isOpen: externalOpen,
  onOpenChange
}: TranscriptDialogProps) {
  const [open, setOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [needsChunking, setNeedsChunking] = useState(false);
  const [transcriptionProvider, setTranscriptionProvider] = useState<'openai' | 'google'>('openai');
  
  const { startProcessingOperation } = useProcessingProgress();
  
  // Sync with external open state if provided
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Check if video needs chunking based on metadata
  useEffect(() => {
    if (project) {
      const videoMetadata = project.video_metadata as ExtendedVideoMetadata | null;
      const isLargeVideo = Boolean(
        videoMetadata?.file_size && (videoMetadata.file_size / (1024 * 1024)) > 24
      );
      const isAlreadyChunked = Boolean(videoMetadata?.chunking?.isChunked);
      
      setNeedsChunking(isLargeVideo && !isAlreadyChunked);
    }
  }, [project]);
  
  // Handle open change and notify parent if callback provided
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };
  
  const handleTranscribe = async () => {
    if (!project) {
      toast.error("Please select a project first.");
      return;
    }
    
    const operation = startProcessingOperation(
      `Transcribing video with ${transcriptionProvider === 'google' ? 'Google Speech-to-Text' : 'OpenAI Whisper'}`, 
      "Starting transcription...",
      "transcription"
    );
    
    try {
      setIsTranscribing(true);
      
      // Update progress for starting
      operation.updateProgress(10, "Preparing audio for transcription");
      
      const transcriptionResult = await transcribeVideo(
        project.id, 
        [], 
        false, 
        null, 
        transcriptionProvider
      );

      if (!transcriptionResult.success) {
        // Check if the error indicates the video is too large
        if (transcriptionResult.error?.includes("too large") || transcriptionResult.needsChunking) {
          setNeedsChunking(true);
          operation.complete(false, "Video is too large and needs chunking");
          return;
        }
        
        toast.error(transcriptionResult.error || "Transcription failed");
        operation.complete(false, `Transcription failed: ${transcriptionResult.error}`);
        return;
      }

      setTranscript(transcriptionResult.transcript || "");
      
      // Update progress during transcription
      operation.updateProgress(50, "Processing transcription");

      if (transcriptionResult.success) {
        toast.success("Video transcribed successfully!");
        operation.complete(true, "Transcription complete");
      } else {
        toast.error(transcriptionResult.error || "Transcription failed");
        operation.complete(false, `Transcription failed: ${transcriptionResult.error}`);
      }
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe video");
      operation.complete(false, `Error: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleChunkingComplete = () => {
    setNeedsChunking(false);
    toast.info("Video prepared for chunked transcription. You can now try transcribing again.");
  };
  
  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isTranscribing}>Transcribe</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transcribe Video</AlertDialogTitle>
          <AlertDialogDescription>
            {transcript
              ? "Transcription complete. View the transcript below."
              : "Are you sure you want to transcribe this video? This process may take a while."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          {needsChunking && project && (
            <ChunkedProcessingAlert 
              projectId={project.id} 
              originalVideoPath={project.source_file_path || ""}
              onComplete={handleChunkingComplete}
            />
          )}
          
          {!transcript && !needsChunking && (
            <div className="grid gap-2">
              <Label htmlFor="transcription-provider">Transcription Service</Label>
              <Select
                value={transcriptionProvider}
                onValueChange={(value) => setTranscriptionProvider(value as 'openai' | 'google')}
              >
                <SelectTrigger className="w-full" id="transcription-provider">
                  <SelectValue placeholder="Select transcription service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI Whisper</SelectItem>
                  <SelectItem value="google">Google Speech-to-Text</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {transcriptionProvider === 'google'
                  ? "Google Speech API provides good accuracy and speaker detection"
                  : "OpenAI Whisper provides fast and accurate transcription"
                }
              </p>
            </div>
          )}
          
          {transcript ? (
            <div className="grid gap-2">
              <Label htmlFor="transcript">Transcript</Label>
              <Input
                type="text"
                id="transcript"
                value={transcript}
                className="outline-none"
                readOnly
              />
            </div>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleTranscribe} disabled={isTranscribing || needsChunking}>
            {isTranscribing ? "Transcribing..." : "Transcribe"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
