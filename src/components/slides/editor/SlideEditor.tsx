
import React, { useState, useEffect } from "react";
import { useSlideEditor } from "./SlideEditorContext";
import { FrameSelector } from "../FrameSelector";
import { SlideEditorHeader } from "./SlideEditorHeader";
import { SlideFilmstrip } from "./SlideFilmstrip";
import { SlidePanels } from "./SlidePanels";
import { SlidePreview } from "../SlidePreview";
import { SlideContent } from "./SlideContent";
import { SlideExportDialog } from "./SlideExportDialog";

export const SlideEditor: React.FC = () => {
  const {
    isLoading,
    isFramePickerModalOpen,
    setIsFramePickerModalOpen,
    handleFrameSelection,
    allExtractedFrames,
    currentSlide,
    projectId
  } = useSlideEditor();
  
  // Determine which frames are selected for the current slide
  const currentSelectedFrames = currentSlide?.imageUrls 
    ? allExtractedFrames.filter(frame => 
        currentSlide.imageUrls?.includes(frame.imageUrl)
      )
    : currentSlide?.imageUrl
      ? allExtractedFrames.filter(frame => frame.imageUrl === currentSlide.imageUrl)
      : [];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading slides...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SlideEditorHeader />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Slide filmstrip */}
        <div className="w-32 border-r bg-muted/20 overflow-y-auto hidden sm:block">
          <SlideFilmstrip />
        </div>
        
        {/* Main slide content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background">
            <SlideContent />
          </div>
          
          {/* Right panel with slide preview and options */}
          <div className="w-full lg:w-[350px] border-l border-t lg:border-t-0 flex flex-col overflow-hidden">
            <SlidePanels />
          </div>
        </div>
      </div>
      
      {/* Frame picker modal */}
      {isFramePickerModalOpen && (
        <FrameSelector
          open={isFramePickerModalOpen}
          onClose={() => setIsFramePickerModalOpen(false)}
          availableFrames={allExtractedFrames}
          selectedFrames={currentSelectedFrames}
          onSelect={handleFrameSelection}
          projectId={projectId}
          slides={[]}
        />
      )}
      
      {/* Export dialog */}
      <SlideExportDialog />
    </div>
  );
};
