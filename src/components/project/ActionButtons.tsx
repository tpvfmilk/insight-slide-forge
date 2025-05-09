
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, Image, Film, Trash2, Info } from "lucide-react";
import { hasValidSlides } from "@/services/slideGenerationService";
import { Project } from "@/services/projectService";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { getFrameStatistics, purgeUnusedFrames, Slide } from "@/utils/frameUtils";
import { useState } from "react";
import { toast } from "sonner";

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
  refreshProject?: () => Promise<void>;
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
  refreshProject
}: ActionButtonsProps) => {
  const [isPurgingFrames, setIsPurgingFrames] = useState(false);
  
  // Function to handle purging unused frames
  const handlePurgeUnusedFrames = async () => {
    if (!project?.id || !project?.slides || isPurgingFrames) return;
    
    setIsPurgingFrames(true);
    toast.loading("Purging unused frames...", { id: "purge-frames" });
    
    try {
      // Ensure project.slides is treated as Slide[]
      const slides = project.slides as unknown as Slide[];
      
      const success = await purgeUnusedFrames(
        project.id, 
        extractedFrames, 
        slides
      );
      
      if (success && refreshProject) {
        await refreshProject();
      }
      
      toast.dismiss("purge-frames");
    } catch (error) {
      console.error("Error purging frames:", error);
      toast.error("Failed to purge unused frames", { id: "purge-frames" });
    } finally {
      setIsPurgingFrames(false);
    }
  };
  
  // Calculate frame statistics
  const frameStats = project?.slides 
    ? getFrameStatistics(extractedFrames, project.slides as unknown as Slide[])
    : { totalExtracted: 0, usedCount: 0, unusedCount: 0 };
    
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
      
      {/* Frame Management Section */}
      {needsFrameExtraction && (
        <div className="flex items-center space-x-2">
          {/* Extract Frames Button with Tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-4 w-64 bg-card border shadow-md">
                <div className="space-y-3">
                  <h4 className="font-medium">Frame Information</h4>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    <span className="text-muted-foreground">Total Extracted:</span>
                    <span>{frameStats.totalExtracted}</span>
                    
                    <span className="text-muted-foreground">Used in Slides:</span>
                    <span>{frameStats.usedCount}</span>
                    
                    <span className="text-muted-foreground">Unused Frames:</span>
                    <span>{frameStats.unusedCount}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Add a separate Purge Frames Button */}
          {frameStats.unusedCount > 0 && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handlePurgeUnusedFrames}
              disabled={isPurgingFrames}
            >
              {isPurgingFrames ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Purging...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Purge {frameStats.unusedCount} Unused Frame{frameStats.unusedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </div>
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
