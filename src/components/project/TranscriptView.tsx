
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Edit2, SlidersIcon, RefreshCw } from "lucide-react";
import { Project } from "@/services/projectService";

interface TranscriptViewProps {
  project: Project | null;
  isGenerating: boolean;
  handleGenerateSlides: () => Promise<void>;
  openTranscriptDialog: () => void;
}

export const TranscriptView = ({ project, isGenerating, handleGenerateSlides, openTranscriptDialog }: TranscriptViewProps) => {
  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Extracted Transcript
            </CardTitle>
            <CardDescription>
              This is the transcript extracted from your video
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-4 bg-muted/20 max-h-[60vh] overflow-y-auto">
              {project?.transcript ? (
                <pre className="whitespace-pre-wrap font-mono text-sm">{project?.transcript}</pre>
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
