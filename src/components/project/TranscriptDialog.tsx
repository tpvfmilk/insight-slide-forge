import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Check, Undo, ArrowDown } from "lucide-react";
import { Project } from "@/services/projectService";
import { updateProject } from "@/services/uploadService";
import { toast } from "sonner";
import { cleanupTranscript, formatWithSpeakers, splitIntoParagraphs, addTimestamps } from "@/utils/transcriptUtils";
import { TranscriptRenderer } from "@/components/transcript/TranscriptRenderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface TranscriptDialogProps {
  project: Project | null;
  transcript: string;
  setTranscript: (transcript: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const TranscriptDialog = ({ 
  project, 
  transcript, 
  setTranscript,
  isOpen,
  onOpenChange
}: TranscriptDialogProps) => {
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  const [originalTranscript, setOriginalTranscript] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<boolean>(true); // Changed to default to true
  const [showTimestamps, setShowTimestamps] = useState<boolean>(true);
  const [highlightSpeakers, setHighlightSpeakers] = useState<boolean>(true);

  // For standalone use
  const open = isOpen !== undefined ? isOpen : isTranscriptDialogOpen;
  const setOpen = onOpenChange || setIsTranscriptDialogOpen;
  
  // Initialize edited transcript when dialog opens or when in tabbed mode
  useEffect(() => {
    if (open || isOpen) {
      setEditedTranscript(transcript || "");
      setOriginalTranscript(transcript || "");
    }
  }, [open, transcript, isOpen]);
  
  const handleSaveTranscript = async () => {
    if (!project?.id) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(project.id, {
        transcript: editedTranscript
      });
      
      // Update the parent state
      setTranscript(editedTranscript);
      
      toast.success("Transcript saved");
      if (setOpen) setOpen(false);
    } catch (error) {
      console.error("Error saving transcript:", error);
      toast.error("Failed to save transcript");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleFormatTranscript = (formatType: 'cleanup' | 'speakers' | 'paragraphs' | 'timestamps' | 'reset') => {
    if (formatType === 'reset') {
      setEditedTranscript(originalTranscript);
      return;
    }
    
    let formattedText = editedTranscript;
    
    switch (formatType) {
      case 'cleanup':
        formattedText = cleanupTranscript(formattedText);
        break;
      case 'speakers':
        formattedText = formatWithSpeakers(formattedText);
        break;
      case 'paragraphs':
        formattedText = splitIntoParagraphs(formattedText);
        break;
      case 'timestamps':
        formattedText = addTimestamps(formattedText);
        break;
      default:
        break;
    }
    
    setEditedTranscript(formattedText);
  };
  
  const formatAllAtOnce = () => {
    let formattedText = editedTranscript;
    formattedText = cleanupTranscript(formattedText);
    formattedText = formatWithSpeakers(formattedText);
    formattedText = splitIntoParagraphs(formattedText);
    setEditedTranscript(formattedText);
    toast.success("Transcript formatted");
  };

  // Content for the component when used in tab mode
  const TabContent = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ToggleGroup variant="outline" type="single" value={previewMode ? "preview" : "edit"}>
            <ToggleGroupItem value="edit" onClick={() => setPreviewMode(false)}>Edit</ToggleGroupItem>
            <ToggleGroupItem value="preview" onClick={() => setPreviewMode(true)}>Preview</ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        <div className="flex items-center space-x-4">
          {previewMode && (
            <>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="show-timestamps" 
                  checked={showTimestamps} 
                  onCheckedChange={setShowTimestamps}
                />
                <Label htmlFor="show-timestamps">Show timestamps</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="highlight-speakers" 
                  checked={highlightSpeakers} 
                  onCheckedChange={setHighlightSpeakers}
                />
                <Label htmlFor="highlight-speakers">Highlight speakers</Label>
              </div>
            </>
          )}
        </div>
      </div>

      {!previewMode ? (
        <>
          <div className="flex flex-wrap gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('reset')}
            >
              <Undo className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('cleanup')}
            >
              <Check className="h-3 w-3 mr-1" />
              Clean up
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('speakers')}
            >
              <Check className="h-3 w-3 mr-1" />
              Format speakers
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('paragraphs')}
            >
              <ArrowDown className="h-3 w-3 mr-1" />
              Add paragraphs
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('timestamps')}
            >
              <Check className="h-3 w-3 mr-1" />
              Add timestamps
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={formatAllAtOnce}
            >
              <Check className="h-3 w-3 mr-1" />
              Format all
            </Button>
          </div>
          
          <Textarea 
            value={editedTranscript}
            onChange={(e) => setEditedTranscript(e.target.value)}
            placeholder="Enter or edit the transcript here..."
            className="min-h-[350px] font-mono text-sm"
            wrap="off"
          />
        </>
      ) : (
        <div className="border rounded-md p-4 min-h-[350px] bg-muted/10 overflow-y-auto">
          <TranscriptRenderer 
            transcript={editedTranscript} 
            showTimestamps={showTimestamps}
            highlightSpeakers={highlightSpeakers}
          />
        </div>
      )}
      
      <div className="flex justify-end mt-4 space-x-2">
        <Button 
          variant="outline" 
          onClick={() => isOpen ? null : setOpen(false)}
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
    </>
  );

  // For standalone mode (when used outside of the tabbed settings dialog)
  if (isOpen === undefined) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
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
            <TabContent />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // For tabbed mode
  return <TabContent />;
};
