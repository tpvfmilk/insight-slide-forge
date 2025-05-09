
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, Image, Film } from "lucide-react";
import { hasValidSlides } from "@/services/slideGenerationService";
import { Project } from "@/services/projectService";

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
  extractedFrames: Array<{ timestamp: string, imageUrl: string }>;
  isTranscriptOnlyProject: boolean;
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
  isTranscriptOnlyProject
}: ActionButtonsProps) => {
  return (
    <div className="flex items-center space-x-2">
      {/* Frame Selection Button */}
      {project?.source_type === 'video' && project?.source_file_path && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleOpenManualFramePicker}
        >
          <Film className="h-4 w-4 mr-2" />
          Select Video Frames
        </Button>
      )}
      
      {/* Extract Frames Button */}
      {needsFrameExtraction && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExtractFrames} 
          disabled={isExtractingFrames}
        >
          {isExtractingFrames ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <Image className="h-4 w-4 mr-2" />
              {extractedFrames.length > 0 ? "Extract Missing Frames" : "Extract Video Frames"}
            </>
          )}
        </Button>
      )}
      
      {/* Transcribe Button */}
      {needsTranscription && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleTranscribeVideo} 
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Transcribing...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-1" />
              Transcribe Video
            </>
          )}
        </Button>
      )}
      
      {/* Generate Slides Button (for non-transcript-only projects) */}
      {!isTranscriptOnlyProject && (
        <Button 
          variant={needsTranscription ? "outline" : "default"} 
          size="sm" 
          onClick={handleGenerateSlides} 
          disabled={isGenerating || (project?.source_type === 'video' && !project?.transcript)}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Generate Slides
            </>
          )}
        </Button>
      )}
      
      {/* Generate Slides Button for transcript-only projects */}
      {isTranscriptOnlyProject && project?.transcript && !hasValidSlides(project) && (
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleGenerateSlides} 
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Generate Slides
            </>
          )}
        </Button>
      )}
    </div>
  );
};
