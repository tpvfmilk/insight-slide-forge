
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
import { useDistill } from "@/context/DistillContext"
import { transcribeVideo } from "@/services/uploadService"
import { useProcessingProgress } from '@/hooks/useOperationProgress'

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
  
  const { startProcessingOperation } = useProcessingProgress();
  
  // Sync with external open state if provided
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);
  
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
      "Transcribing video", 
      "Starting transcription...",
      "transcription"
    );
    
    try {
      setIsTranscribing(true);
      
      // Update progress for starting
      operation.updateProgress(10, "Preparing audio for transcription");
      
      const transcriptionResult = await transcribeVideo(project.id);

      if (!transcriptionResult.success) {
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
          {!transcript ? null : (
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
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleTranscribe} disabled={isTranscribing}>
            {isTranscribing ? "Transcribing..." : "Transcribe"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
