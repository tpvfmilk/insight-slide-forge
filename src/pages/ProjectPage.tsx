import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { SlideEditor } from "@/components/slides/SlideEditor";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectSettingsDialog } from "@/components/project/ProjectSettingsDialog";
import { ActionButtons } from "@/components/project/ActionButtons";
import { TranscriptView } from "@/components/project/TranscriptView";
import { useProjectState } from "@/hooks/useProjectState";
import { useProjectModals } from "@/hooks/useProjectModals";
import { hasValidSlides } from "@/services/slideGenerationService";
import { clientExtractFramesFromVideo } from "@/services/clientFrameExtractionService";

const ProjectPage = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const modals = useProjectModals();
  
  const {
    project,
    isLoading,
    isGenerating,
    isTranscribing,
    isExtractingFrames,
    contextPrompt,
    setContextPrompt,
    transcript,
    setTranscript,
    slidesPerMinute,
    setSlidesPerMinute,
    videoFileName,
    needsFrameExtraction,
    allTimestamps,
    videoMetadata,
    extractedFrames,
    needsTranscription,
    isTranscriptOnlyProject,
    loadProject,
    handleGenerateSlides,
    handleTranscribeVideo,
    handleExtractFrames,
    handleManualFrameSelectionComplete,
  } = useProjectState(projectId);
  
  // Empty placeholder method that's not used since the button is removed
  const handleOpenManualFramePicker = () => {};

  // Process frames using client-side extraction only when manually triggered
  const processFrameExtraction = async () => {
    // We keep this method as it may be used from other parts of the code
    // but we won't call it automatically
    if (!project?.source_file_path || !projectId || !allTimestamps || allTimestamps.length === 0) {
      toast.error("Unable to extract frames: missing video or timestamps");
      return;
    }
    
    try {
      // Use client-side extraction
      const result = await clientExtractFramesFromVideo(
        projectId,
        project.source_file_path,
        allTimestamps,
        videoMetadata?.duration
      );
      
      if (result.success && result.frames) {
        handleManualFrameSelectionComplete(result.frames);
        toast.success(`Successfully extracted ${result.frames.length} frames`);
      } else {
        toast.error(result.error || "Failed to extract frames");
      }
    } catch (error) {
      console.error("Frame extraction error:", error);
      toast.error("Failed to extract frames");
    }
  };

  const handleVideoAdded = () => {
    loadProject(); // Reload the project to get updated video list
  };
  
  return (
    <InsightLayout>
      <div className="h-full flex flex-col">
        <div className="border-b p-4 flex items-center justify-between">
          <ProjectPageHeader 
            project={project} 
            isLoading={isLoading}
            videoFileName={videoFileName}
            onVideoAdded={handleVideoAdded}
          />
          
          <div className="flex items-center space-x-2">
            {/* Combined Settings Dialog */}
            <ProjectSettingsDialog
              project={project}
              transcript={transcript}
              setTranscript={setTranscript}
              slidesPerMinute={slidesPerMinute}
              setSlidesPerMinute={setSlidesPerMinute}
              contextPrompt={contextPrompt}
              setContextPrompt={setContextPrompt}
            />
            
            {/* Action buttons */}
            <ActionButtons 
              project={project}
              needsFrameExtraction={needsFrameExtraction}
              isExtractingFrames={isExtractingFrames}
              handleExtractFrames={handleExtractFrames}
              needsTranscription={needsTranscription}
              isTranscribing={isTranscribing}
              handleTranscribeVideo={handleTranscribeVideo}
              isGenerating={isGenerating}
              handleGenerateSlides={handleGenerateSlides}
              handleOpenManualFramePicker={handleOpenManualFramePicker}
              extractedFrames={extractedFrames}
              isTranscriptOnlyProject={isTranscriptOnlyProject}
              refreshProject={loadProject}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
                <p className="text-sm text-muted-foreground">Loading project...</p>
              </div>
            </div>
          ) : isTranscriptOnlyProject && !hasValidSlides(project) ? (
            <TranscriptView 
              project={project}
              isGenerating={isGenerating}
              handleGenerateSlides={handleGenerateSlides}
              openTranscriptDialog={() => modals.openTranscriptDialog()}
            />
          ) : (
            <SlideEditor />
          )}
        </div>
      </div>
    </InsightLayout>
  );
};

export default ProjectPage;
