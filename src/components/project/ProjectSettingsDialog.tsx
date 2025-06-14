
import { useState } from "react";
import { SafeDialog, SafeDialogContent } from "@/components/ui/safe-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings } from "lucide-react";
import { Project } from "@/services/projectService";
import { TranscriptDialog } from "@/components/project/TranscriptDialog";
import { ContextDialog } from "@/components/project/ContextDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectSettingsDialogProps {
  project: Project | null;
  transcript: string;
  setTranscript: (transcript: string) => void;
  contextPrompt: string;
  setContextPrompt: (value: string) => void;
}

export const ProjectSettingsDialog = ({
  project,
  transcript,
  setTranscript,
  contextPrompt,
  setContextPrompt,
}: ProjectSettingsDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");

  // Function to properly close the dialog and clean up UI elements
  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <SafeDialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          Project Settings
        </Button>
      </DialogTrigger>
      <SafeDialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="max-h-[70vh] overflow-y-auto">
            <TabsContent value="transcript" className="focus:outline-none">
              {activeTab === "transcript" && (
                <TranscriptDialog 
                  project={project}
                  transcript={transcript}
                  setTranscript={setTranscript}
                  isOpen={true}
                  onOpenChange={(open) => {
                    if (!open) {
                      handleClose();
                    }
                  }}
                />
              )}
            </TabsContent>
            
            <TabsContent value="context" className="focus:outline-none">
              {activeTab === "context" && (
                <ContextDialog 
                  project={project}
                  contextPrompt={contextPrompt}
                  setContextPrompt={setContextPrompt}
                  isOpen={true}
                  onOpenChange={(open) => {
                    if (!open) {
                      handleClose();
                    }
                  }}
                />
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SafeDialogContent>
    </SafeDialog>
  );
};
