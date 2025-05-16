
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
import { ExtendedVideoMetadata } from "@/types/videoChunking";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { StorageBucketVerifier } from "@/components/storage/StorageBucketVerifier";
import { initializeStorage } from "@/services/storageService";
import { useEffect, useState } from "react";
import { useAudioChunking } from "@/context/AudioChunkingContext";
import { ChunkedProcessingAlert } from "@/components/project/ChunkedProcessingAlert";

const ProjectPage = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const modals = useProjectModals();
  const { prepareForChunkedProcessing } = useAudioChunking();
  const [hasInitiatedAudioProcessing, setHasInitiatedAudioProcessing] = useState(false);
  
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

  // Ensure storage buckets are initialized when the project page loads
  useEffect(() => {
    const checkStorage = async () => {
      try {
        await initializeStorage();
      } catch (err) {
        console.error("Error initializing storage:", err);
        toast.error("Storage initialization failed. Some features may not work correctly.");
      }
    };
    
    checkStorage();
  }, []);
  
  // Auto-process large videos that need chunking but haven't been chunked yet
  useEffect(() => {
    // Skip if already processing, already processed, or we're still loading
    if (hasInitiatedAudioProcessing || isLoading || !project || !projectId) return;
    
    // Check if this is a large video that hasn't been chunked yet
    const extendedMetadata = videoMetadata as ExtendedVideoMetadata | null;
    const hasChunkedVideo = Boolean(
      extendedMetadata?.chunking?.isChunked ||
      (project?.video_metadata as ExtendedVideoMetadata | null)?.chunking?.isChunked
    );
    
    const isLargeVideo = Boolean(
      extendedMetadata?.file_size && (extendedMetadata.file_size / (1024 * 1024)) > 24
    );
    
    const hasTooLargeTranscriptError = transcript?.includes("too large for direct transcription");
    
    // If it's a large video, that hasn't been chunked but has the error, auto-process it
    if (isLargeVideo && !hasChunkedVideo && hasTooLargeTranscriptError && project.source_file_path) {
      console.log("[DEBUG] Automatically processing large video for chunking");
      setHasInitiatedAudioProcessing(true);
    }
  }, [project, videoMetadata, transcript, hasInitiatedAudioProcessing, isLoading, projectId]);
  
  const handleOpenManualFramePicker = () => {
    if (!project?.source_file_path) {
      toast.error("No video available");
      return;
    }
    console.log("[DEBUG] Opening frame picker modal with", extractedFrames?.length || 0, "extracted frames");
    modals.openFramePickerModal();
    
    // Force reload project to ensure we have the latest frames
    loadProject();
  };
  
  // Handler for when frames are selected in the frame picker
  const handleFrameSelection = async (selectedFrames) => {
    console.log(`[DEBUG] Frame selection complete with ${selectedFrames.length} frames`);
    const toastId = "frame-processing";
    
    try {
      toast.loading("Processing selected frames...", { id: toastId });
      
      if (selectedFrames.length === 0) {
        toast.error("No frames were selected", { id: toastId });
        return;
      }
      
      // Pass the selected frames to be handled in the project state
      const success = await handleManualFrameSelectionComplete(selectedFrames);
      
      if (success) {
        // Close the modal
        modals.closeFramePickerModal();
        toast.success(`Successfully applied ${selectedFrames.length} frames to slide`, { id: toastId });
        
        // After frames are processed, reload the project to reflect changes
        await loadProject();
      } else {
        toast.error("Failed to apply frames to slide", { id: toastId });
      }
    } catch (error) {
      console.error("[DEBUG] Error processing frames:", error);
      toast.error("An error occurred while processing frames", { id: toastId });
    }
  };
  
  // Check if this project has chunked video content - with proper type safety
  const extendedMetadata = videoMetadata as ExtendedVideoMetadata | null;
  const hasChunkedVideo = Boolean(
    extendedMetadata?.chunking?.isChunked ||
    (project?.video_metadata as ExtendedVideoMetadata | null)?.chunking?.isChunked
  );
  
  // Check if the video is large and might need chunking
  const isLargeVideo = Boolean(
    extendedMetadata?.file_size && (extendedMetadata.file_size / (1024 * 1024)) > 24
  );
  
  // Check if we have a "too large" transcript error message
  const hasTooLargeTranscriptError = transcript?.includes("too large for direct transcription");
  
  // Function to handle force-chunking a video
  const handleForceChunking = async () => {
    if (!projectId || !project?.source_file_path) return;
    
    const success = await prepareForChunkedProcessing(projectId, project.source_file_path);
    
    if (success) {
      // Re-load project data to get updated metadata
      await loadProject();
    }
  };
  
  // Show storage verification UI if we have issues with chunked videos
  const showStorageVerifier = hasTooLargeTranscriptError || 
                             (hasChunkedVideo && transcript?.includes("Error transcribing this chunk"));
  
  return (
    <InsightLayout>
      <div className="h-full flex flex-col overflow-x-hidden">
        <div className="border-b p-4 flex items-center justify-between">
          <ProjectPageHeader 
            project={project} 
            isLoading={isLoading}
            videoFileName={videoFileName}
            totalVideoDuration={totalVideoDuration}
            hasChunkedVideo={hasChunkedVideo}
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
              totalDuration={totalVideoDuration}
              hideSelectFrames={true}
              hasChunkedVideo={hasChunkedVideo}
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
          ) : showStorageVerifier ? (
            <div className="p-4">
              {hasTooLargeTranscriptError && !hasChunkedVideo && isLargeVideo && (
                <ChunkedProcessingAlert
                  projectId={projectId || ""}
                  originalVideoPath={project?.source_file_path || ""}
                  onComplete={() => loadProject()}
                  autoProcess={hasInitiatedAudioProcessing}
                />
              )}
              
              {/* Storage bucket verification component */}
              <StorageBucketVerifier />
              
              {(hasChunkedVideo && transcript?.includes("Error transcribing this chunk")) && (
                <Alert className="mt-4" variant="warning">
                  <AlertTitle>Chunked transcription incomplete</AlertTitle>
                  <AlertDescription>
                    <p>There were issues accessing some video chunks for transcription. Please use the verification tool above to fix storage issues.</p>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => loadProject()}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
                >
                  Continue to Project
                </button>
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
          hasChunkedVideo={hasChunkedVideo}
        />
      )}
    </InsightLayout>
  );
};

export default ProjectPage;
