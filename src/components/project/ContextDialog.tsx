
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings2, RefreshCw } from "lucide-react";
import { ContextPromptInput } from "@/components/upload/ContextPromptInput";
import { Project } from "@/services/projectService";
import { updateProject } from "@/services/uploadService";
import { toast } from "sonner";

interface ContextDialogProps {
  project: Project | null;
  contextPrompt: string;
  setContextPrompt: (value: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ContextDialog = ({ 
  project, 
  contextPrompt, 
  setContextPrompt,
  isOpen,
  onOpenChange
}: ContextDialogProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editedContextPrompt, setEditedContextPrompt] = useState<string>("");

  const open = isOpen !== undefined ? isOpen : isDialogOpen;
  const setOpen = onOpenChange || setIsDialogOpen;
  
  // Initialize edited context prompt when dialog opens
  useEffect(() => {
    if (open) {
      setEditedContextPrompt(contextPrompt || "");
    }
  }, [open, contextPrompt]);

  const handleSaveContext = async () => {
    if (!project?.id) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(project.id, {
        context_prompt: editedContextPrompt
      });
      
      // Update the parent state
      setContextPrompt(editedContextPrompt);
      
      toast.success("Context prompt saved");
      setOpen(false);
    } catch (error) {
      console.error("Error saving context:", error);
      toast.error("Failed to save context prompt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1" />
          Context Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slide Generation Context</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <ContextPromptInput 
            value={editedContextPrompt}
            onChange={setEditedContextPrompt}
          />
          
          <div className="flex justify-end mt-4 space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveContext}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : "Save Context"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
