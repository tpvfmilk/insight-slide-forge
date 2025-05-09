
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { SlideEditor } from "@/components/slides/SlideEditor";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { FrameExtractionModal } from "@/components/video/FrameExtractionModal";
import { FramePickerModal } from "@/components/video/FramePickerModal";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectSettingsDialog } from "@/components/project/ProjectSettingsDialog";
import { ActionButtons } from "@/components/project/ActionButtons";
import { TranscriptView } from "@/components/project/TranscriptView";
import { useProjectState } from "@/hooks/useProjectState";
import { useProjectModals } from "@/hooks/useProjectModals";
import { hasValidSlides } from "@/services/slideGenerationService";
import { FrameSelector } from "@/components/slides/FrameSelector";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { Slide } from "@/utils/frameUtils";

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
    handleFrameExtractionComplete,
    handleManualFrameSelectionComplete,
  } = useProjectState(projectId);
  
  const handleOpenManualFramePicker = () => {
    if (!project?.source_file_path) {
      toast.error("No video source available");
      return;
    }
    
    modals.openFramePickerModal();
  };

  const processFrameExtraction = async () => {
    if (!project?.source_file_path) return;
    
    const result = await handleExtractFrames();
    if (result?.openFrameExtractionModal) {
      modals.openFrameExtractionModal();
    }
  };
  
  return (
    <InsightLayout>
      <div className="h-full flex flex-col">
        <div className="border-b p-4 flex items-center justify-between">
          <ProjectPageHeader 
            project={project} 
            isLoading={isLoading}
            videoFileName={videoFileName}
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
              handleExtractFrames={processFrameExtraction}
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
        
        {/* Frame Extraction Modal */}
        {project && project.source_file_path && (
          <FrameExtractionModal
            open={modals.isFrameExtractionModalOpen}
            onClose={() => modals.closeFrameExtractionModal()}
            videoPath={project.source_file_path}
            projectId={projectId || ""}
            timestamps={allTimestamps.filter(timestamp => 
              !extractedFrames.some(frame => frame.timestamp === timestamp)
            )}
            onComplete={handleFrameExtractionComplete}
            videoMetadata={videoMetadata || undefined}
            previouslyExtractedFrames={extractedFrames}
          />
        )}
        
        {/* Frame Picker Modal */}
        {project && project.source_file_path && (
          <FramePickerModal
            open={modals.isFramePickerModalOpen}
            onClose={() => modals.closeFramePickerModal()}
            videoPath={project.source_file_path}
            projectId={projectId || ""}
            onComplete={handleManualFrameSelectionComplete}
            videoMetadata={videoMetadata || undefined}
            existingFrames={extractedFrames}
          />
        )}

        {/* Frame Selector for selecting frames */}
        {project && (
          <FrameSelector
            open={modals.isFramePickerModalOpen} 
            onClose={() => modals.closeFramePickerModal()}
            availableFrames={extractedFrames}
            selectedFrames={extractedFrames}
            onSelect={(frames: ExtractedFrame[]) => handleManualFrameSelectionComplete(frames)}
            projectId={projectId}
            onRefresh={loadProject}
            slides={project.slides as Slide[]}
          />
        )}
      </div>
    </InsightLayout>
  );
};

export default ProjectPage;
