
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
  hideSelectFrames?: boolean;
  hasChunkedVideo?: boolean; // Added this prop
}

export const ActionButtons = ({
  project,
  needsTranscription,
  isTranscribing,
  handleTranscribeVideo,
  isGenerating,
  handleGenerateSlides,
  handleOpenManualFramePicker,
  isTranscriptOnlyProject,
  hideSelectFrames = false,
  hasChunkedVideo = false, // Added default value
}: ActionButtonsProps) => {
  return (
    <>
      {needsTranscription && (
        <Button 
          variant="outline"
          disabled={isTranscribing}
          onClick={handleTranscribeVideo}
          title={hasChunkedVideo ? "Transcribe all video chunks" : "Transcribe video"}
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
      
      {/* Only show Select Frames button if hideSelectFrames is false */}
      {!hideSelectFrames && (
        <Button 
          variant="outline" 
          onClick={handleOpenManualFramePicker}
        >
          <Film className="mr-2 h-4 w-4" />
          Select Frames
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
