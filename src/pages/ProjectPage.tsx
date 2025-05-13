
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
import { FramePickerModal } from "@/components/video/FramePickerModal";

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
    totalVideoDuration
  } = useProjectState(projectId);
  
  const handleOpenManualFramePicker = () => {
    if (!project?.source_file_path) {
      toast.error("No video available");
      return;
    }
    console.log("Opening frame picker modal with", extractedFrames?.length || 0, "extracted frames");
    modals.openFramePickerModal();
    
    // Force reload project to ensure we have the latest frames
    loadProject();
  };
  
  // Handler for when frames are selected in the frame picker
  const handleFrameSelection = async (selectedFrames) => {
    console.log(`Frame selection complete with ${selectedFrames.length} frames`);
    const toastId = "frame-processing";
    
    try {
      toast.loading("Processing selected frames...", { id: toastId });
      
      if (selectedFrames.length === 0) {
        toast.error("No frames were selected", { id: toastId });
        return;
      }
      
      // Pass the selected frames to be handled in the project state
      // Note: we're now only applying these frames to the current slide,
      // not removing them from the global library
      const success = await handleManualFrameSelectionComplete(selectedFrames);
      
      if (success) {
        // Close the modal
        modals.closeFramePickerModal();
        toast.success(`Successfully applied ${selectedFrames.length} frames to slide`, { id: toastId });
        
        // After frames are processed, reload the project to reflect changes
        // This is crucial for keeping the frame library in sync
        await loadProject();
      } else {
        toast.error("Failed to apply frames to slide", { id: toastId });
      }
    } catch (error) {
      console.error("Error processing frames:", error);
      toast.error("An error occurred while processing frames", { id: toastId });
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
            totalVideoDuration={totalVideoDuration}
          />
          
          <div className="flex items-center space-x-2">
            {/* Combined Settings Dialog */}
            <ProjectSettingsDialog
              project={project}
              transcript={transcript}
              setTranscript={setTranscript}
              contextPrompt={contextPrompt}
              setContextPrompt={setContextPrompt}
            />
            
            {/* Action buttons - passing hideSelectFrames=true to hide the Select Frames button */}
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
              totalDuration={totalVideoDuration}
              hideSelectFrames={true} // Add this prop to hide the Select Frames button
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

      {/* Frame Picker Modal with Library */}
      {modals.isFramePickerModalOpen && project?.source_file_path && (
        <FramePickerModal
          open={modals.isFramePickerModalOpen}
          onClose={() => {
            modals.closeFramePickerModal();
            // Force reload project after closing modal to ensure we have the latest frames
            loadProject();
          }} 
          videoPath={project.source_file_path}
          projectId={projectId || ""}
          onFramesSelected={handleFrameSelection}
          allExtractedFrames={extractedFrames || []}
          existingFrames={[]} // This will be populated by the SlideEditor when needed
        />
      )}
    </InsightLayout>
  );
};

export default ProjectPage;
