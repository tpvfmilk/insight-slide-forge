
import { useState } from "react";
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
}

export const ContextDialog = ({ project, contextPrompt, setContextPrompt }: ContextDialogProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveContext = async () => {
    if (!project?.id) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(project.id, {
        context_prompt: contextPrompt
      });
      
      toast.success("Context prompt saved");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving context:", error);
      toast.error("Failed to save context prompt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            value={contextPrompt}
            onChange={setContextPrompt}
          />
          
          <div className="flex justify-end mt-4 space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
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
