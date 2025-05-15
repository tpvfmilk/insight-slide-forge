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

export interface ActionButtonsProps {
  project: Project | null;
  needsFrameExtraction?: boolean;
  isExtractingFrames?: boolean;
  handleExtractFrames: () => Promise<void>;
  needsTranscription?: boolean;
  isTranscribing?: boolean;
  handleTranscribeVideo: () => Promise<void>;
  isGenerating?: boolean;
  handleGenerateSlides: () => Promise<void>;
  handleOpenManualFramePicker?: () => void;
  extractedFrames?: ExtractedFrame[];
  isTranscriptOnlyProject?: boolean;
  refreshProject?: () => void;
  totalDuration?: number;
  hideSelectFrames?: boolean;
  hasChunkedVideo?: boolean;
}

export function ActionButtons({
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
  totalDuration,
  hideSelectFrames,
  hasChunkedVideo
}: ActionButtonsProps) {
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
}
