import React, { useState, useCallback } from 'react';
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
import { transcribeVideo } from "@/services/uploadService";
import { useProcessingProgress } from '@/hooks/useOperationProgress';

export function TranscriptDialog() {
  const [open, setOpen] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isTranscribing, setIsTranscribing] = useState(false)
  const { selectedProject, updateProjectData } = useDistill();
  
  const { startProcessingOperation } = useProcessingProgress();
  
  const handleTranscribe = async () => {
    if (!selectedProject) {
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
      
      const transcriptionResult = await transcribeVideo(selectedProject.id);

      if (!transcriptionResult.success) {
        toast.error(transcriptionResult.error || "Transcription failed");
        operation.complete(false, `Transcription failed: ${transcriptionResult.error}`);
        return;
      }

      setTranscript(transcriptionResult.transcript || "");
      
      // Update progress during transcription
      operation.updateProgress(50, "Processing transcription");

      // Update the project data with the new transcript
      updateProjectData({ transcript: transcriptionResult.transcript });
      
      if (transcriptionResult.success) {
        toast.success("Video transcribed successfully!");
        operation.complete(true, "Transcription complete");
      } else {
        toast.error(transcriptionResult.error || "Transcription failed");
        operation.complete(false, `Transcription failed: ${transcriptionResult.error}`);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe video");
      operation.complete(false, `Error: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };
  
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
  )
}
