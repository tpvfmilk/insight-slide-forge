
import React from "react";
import { FramePickerModal } from "@/components/video/FramePickerModal";
import { useSlideEditor } from "./SlideEditorContext";
import { SlideEditorHeader } from "./SlideEditorHeader";
import { SlidePanels } from "./SlidePanels";
import { SlideControls } from "./SlideControls";
import { SlideFilmstrip } from "./SlideFilmstrip";
import { SlideEditorStyles } from "../SlideEditorStyles";
import { SlideEditorProps } from "./SlideEditorTypes";

// Export the inner content component that uses the context
export const SlideEditorContent: React.FC<SlideEditorProps> = ({ projectId }) => {
  const {
    isLoading,
    currentSlide,
    isFramePickerModalOpen,
    setIsFramePickerModalOpen,
    handleFrameSelection,
    allExtractedFrames,
    videoPath
  } = useSlideEditor();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-x-hidden">
      {/* Custom styles for dragging */}
      <SlideEditorStyles />
      
      {/* Header section */}
      <SlideEditorHeader />

      {/* Main slide editing area */}
      <div className="flex-1 w-full overflow-hidden">
        <SlidePanels />
      </div>
      
      {/* Navigation controls */}
      <SlideControls />
      
      {/* Filmstrip */}
      <SlideFilmstrip />
      
      {/* Frame Picker Modal */}
      {isFramePickerModalOpen && videoPath && (
        <FramePickerModal
          open={isFramePickerModalOpen}
          onClose={() => setIsFramePickerModalOpen(false)} 
          videoPath={videoPath}
          projectId={projectId || ""}
          onFramesSelected={handleFrameSelection}
          allExtractedFrames={allExtractedFrames}
          existingFrames={currentSlide?.imageUrls?.map(url => {
            // Try to find the matching extracted frame by URL
            const matchingFrame = allExtractedFrames.find(frame => frame.imageUrl === url);
            if (matchingFrame) {
              return matchingFrame;
            }
            // Create a placeholder frame object if no match is found
            return {
              imageUrl: url,
              timestamp: "unknown",
              id: `url-${url.split('/').pop()}`,
              isPlaceholder: true
            };
          }) || []}
        />
      )}
    </div>
  );
};
