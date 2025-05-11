
import { Button } from "@/components/ui/button";
import { Project } from "@/services/projectService";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { 
  Loader2, 
  ListVideo, 
  Brain, 
  Image,
  Wand2,
  Film
} from "lucide-react";

interface ActionButtonsProps {
  project: Project | null;
  needsFrameExtraction: boolean;
  isExtractingFrames: boolean;
  handleExtractFrames: () => void;
  needsTranscription: boolean;
  isTranscribing: boolean;
  handleTranscribeVideo: () => void;
  isGenerating: boolean;
  handleGenerateSlides: () => void;
  handleOpenManualFramePicker: () => void;
  extractedFrames: ExtractedFrame[] | null;
  isTranscriptOnlyProject: boolean;
  refreshProject: () => void;
  totalDuration?: number;
}

export const ActionButtons = ({
  project,
  needsFrameExtraction,
  isExtractingFrames,
  handleExtractFrames,
  needsTranscription,
  isTranscribing,
  handleTranscribeVideo,
  isGenerating,
  handleGenerateSlides,
  handleOpenManualFramePicker,
  extractedFrames,
  isTranscriptOnlyProject,
  refreshProject,
  totalDuration
}: ActionButtonsProps) => {
  return (
    <>
      {needsTranscription && (
        <Button 
          variant="outline"
          disabled={isTranscribing}
          onClick={handleTranscribeVideo}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Transcribing...
            </>
          ) : (
            <>
              <ListVideo className="mr-2 h-4 w-4" />
              Transcribe Video
            </>
          )}
        </Button>
      )}
      
      <Button 
        disabled={isGenerating || !project}
        onClick={handleGenerateSlides}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Brain className="mr-2 h-4 w-4" />
            Generate Slides
          </>
        )}
      </Button>
    </>
  );
};
