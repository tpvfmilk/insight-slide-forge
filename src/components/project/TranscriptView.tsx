
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Edit2, SlidersIcon, RefreshCw, Copy, Check } from "lucide-react";
import { Project } from "@/services/projectService";
import { TranscriptRenderer } from "@/components/transcript/TranscriptRenderer";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TranscriptViewProps {
  project: Project | null;
  isGenerating: boolean;
  handleGenerateSlides: () => Promise<void>;
  openTranscriptDialog: () => void;
}

export const TranscriptView = ({ project, isGenerating, handleGenerateSlides, openTranscriptDialog }: TranscriptViewProps) => {
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [highlightSpeakers, setHighlightSpeakers] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  
  const handleCopyTranscript = async () => {
    if (!project?.transcript) return;
    
    try {
      await navigator.clipboard.writeText(project.transcript);
      setIsCopied(true);
      toast.success("Transcript copied to clipboard");
      
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Error copying transcript:", error);
      toast.error("Failed to copy transcript");
    }
  };
  
  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Extracted Transcript
              </CardTitle>
              
              {project?.transcript && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyTranscript}
                  className={cn("flex items-center gap-1", isCopied && "text-green-500")}
                >
                  {isCopied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </div>
            <CardDescription>
              This is the transcript extracted from your video
            </CardDescription>
            
            {project?.transcript && (
              <div className="flex flex-wrap gap-4 mt-2">
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
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-4 bg-muted/20 max-h-[60vh] overflow-y-auto">
              {project?.transcript ? (
                <TranscriptRenderer 
                  transcript={project.transcript}
                  showTimestamps={showTimestamps}
                  highlightSpeakers={highlightSpeakers}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No transcript available. There might have been an issue with the transcription process.</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="mt-4"
                    onClick={openTranscriptDialog}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Add Transcript Manually
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={openTranscriptDialog}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Transcript
            </Button>
            <Button 
              onClick={handleGenerateSlides}
              disabled={isGenerating || !project?.transcript}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating Slides...
                </>
              ) : (
                <>
                  <SlidersIcon className="h-4 w-4 mr-2" />
                  Generate Slides
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
