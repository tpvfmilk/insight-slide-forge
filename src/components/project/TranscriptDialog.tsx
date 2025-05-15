
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Project } from "@/services/projectService";
import { Textarea } from "@/components/ui/textarea";
import { updateProject } from "@/services/projectService";
import { toast } from "sonner";

interface TranscriptDialogProps {
  project: Project | null;
  isOpen: boolean;
  transcript: string;
  setTranscript: (transcript: string) => void;
  onOpenChange: (open: boolean) => void;
}

export const TranscriptDialog = ({
  project,
  isOpen,
  transcript,
  setTranscript,
  onOpenChange,
}: TranscriptDialogProps) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [localTranscript, setLocalTranscript] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Initialize local transcript when the component mounts or project/transcript changes
  useEffect(() => {
    if (isOpen) {
      setLocalTranscript(transcript || "");
    }
  }, [isOpen, transcript]);
  
  const handleTranscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalTranscript(e.target.value);
  };
  
  const handleSave = async () => {
    if (!project?.id) return;
    
    setIsSaving(true);
    
    try {
      // Update the transcript in the database
      await updateProject(project.id, { transcript: localTranscript });
      
      // Update the local state
      setTranscript(localTranscript);
      
      toast.success("Transcript saved successfully");
    } catch (error) {
      console.error("Error saving transcript:", error);
      toast.error("Failed to save transcript");
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="flex flex-col h-[600px] max-h-[80vh]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="edit" className="flex-1 flex flex-col h-full">
          <Textarea
            value={localTranscript}
            onChange={handleTranscriptChange}
            className="flex-1 min-h-[400px]"
            placeholder="Enter or edit the transcript here..."
          />
          <div className="flex justify-end mt-4">
            <Button
              variant="default"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="preview" className="h-full flex flex-col">
          <ScrollArea className="flex-1 border rounded-md p-4 whitespace-pre-wrap">
            {localTranscript || "No transcript available."}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
