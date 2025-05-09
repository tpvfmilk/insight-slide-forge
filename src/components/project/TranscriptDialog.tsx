
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw } from "lucide-react";
import { Project } from "@/services/projectService";
import { updateProject } from "@/services/uploadService";
import { toast } from "sonner";

interface TranscriptDialogProps {
  project: Project | null;
  transcript: string;
  setTranscript: (transcript: string) => void;
}

export const TranscriptDialog = ({ project, transcript, setTranscript }: TranscriptDialogProps) => {
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveTranscript = async () => {
    if (!project?.id) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(project.id, {
        transcript: transcript
      });
      
      toast.success("Transcript saved");
      setIsTranscriptDialogOpen(false);
    } catch (error) {
      console.error("Error saving transcript:", error);
      toast.error("Failed to save transcript");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isTranscriptDialogOpen} onOpenChange={setIsTranscriptDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-1" />
          {project?.transcript ? "Edit Transcript" : "Add Transcript"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Video Transcript</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Enter or edit the transcript here..."
            className="min-h-[400px] font-mono text-sm"
            wrap="off"
          />
          
          <div className="flex justify-end mt-4 space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsTranscriptDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTranscript}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : "Save Transcript"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
