
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import { Project } from "@/services/projectService";
import { TranscriptDialog } from "@/components/project/TranscriptDialog";
import { DensityDialog } from "@/components/project/DensityDialog";
import { ContextDialog } from "@/components/project/ContextDialog";

interface ProjectSettingsDialogProps {
  project: Project | null;
  transcript: string;
  setTranscript: (transcript: string) => void;
  slidesPerMinute: number;
  setSlidesPerMinute: (value: number) => void;
  contextPrompt: string;
  setContextPrompt: (value: string) => void;
}

export const ProjectSettingsDialog = ({
  project,
  transcript,
  setTranscript,
  slidesPerMinute,
  setSlidesPerMinute,
  contextPrompt,
  setContextPrompt,
}: ProjectSettingsDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          Project Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="density">Slide Density</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
          </TabsList>
          
          <TabsContent value="transcript" className="focus:outline-none">
            <TranscriptDialog 
              project={project}
              transcript={transcript}
              setTranscript={setTranscript}
              isOpen={activeTab === "transcript"}
              onOpenChange={(open) => {
                if (!open) {
                  setIsOpen(false);
                }
              }}
            />
          </TabsContent>
          
          <TabsContent value="density" className="focus:outline-none">
            <DensityDialog 
              project={project}
              slidesPerMinute={slidesPerMinute}
              setSlidesPerMinute={setSlidesPerMinute}
            />
          </TabsContent>
          
          <TabsContent value="context" className="focus:outline-none">
            <ContextDialog 
              project={project}
              contextPrompt={contextPrompt}
              setContextPrompt={setContextPrompt}
              isOpen={activeTab === "context"}
              onOpenChange={(open) => {
                if (!open) {
                  setIsOpen(false);
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
