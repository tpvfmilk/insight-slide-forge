
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText } from "lucide-react";
import { hasValidSlides } from "@/services/slideGenerationService";
import { Project } from "@/services/projectService";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

interface ActionButtonsProps {
  project: Project | null;
  needsFrameExtraction: boolean;
  isExtractingFrames: boolean;
  handleExtractFrames: () => Promise<void>;
  needsTranscription: boolean;
  isTranscribing: boolean;
  handleTranscribeVideo: () => Promise<void>;
  isGenerating: boolean;
  handleGenerateSlides: () => Promise<void>;
  handleOpenManualFramePicker: () => void;
  extractedFrames: ExtractedFrame[];
  isTranscriptOnlyProject: boolean;
  refreshProject?: () => Promise<void>;
}

export const ActionButtons = ({
  project,
  needsTranscription,
  isTranscribing,
  handleTranscribeVideo,
  isGenerating,
  handleGenerateSlides,
  isTranscriptOnlyProject
}: ActionButtonsProps) => {
  return <div className="flex items-center space-x-2">
      {/* "Select Video Frames" button removed as it's redundant with one in the slide editor */}
      
      {/* Transcribe Button */}
      {needsTranscription && <Button variant="outline" size="sm" onClick={handleTranscribeVideo} disabled={isTranscribing}>
          {isTranscribing ? <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Transcribing...
            </> : <>
              <FileText className="h-4 w-4 mr-1" />
              Transcribe Video
            </>}
        </Button>}
      
      {/* Generate Slides Button (for non-transcript-only projects) */}
      {!isTranscriptOnlyProject && <Button variant={needsTranscription ? "outline" : "default"} size="sm" onClick={handleGenerateSlides} disabled={isGenerating || project?.source_type === 'video' && !project?.transcript}>
          {isGenerating ? <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Generating...
            </> : <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Generate Slides
            </>}
        </Button>}
      
      {/* Generate Slides Button for transcript-only projects */}
      {isTranscriptOnlyProject && project?.transcript && !hasValidSlides(project) && <Button variant="default" size="sm" onClick={handleGenerateSlides} disabled={isGenerating}>
          {isGenerating ? <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Generating...
            </> : <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Generate Slides
            </>}
        </Button>}
    </div>;
};
