
import React from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { SlideImageGallery } from "./SlideImageGallery";
import { SlideContent } from "./SlideContent";

export const SlidePanels: React.FC = () => {
  return (
    <div className="w-full h-full p-4">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left side - Images */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <SlideImageGallery />
        </ResizablePanel>
        
        {/* Resizable handle with improved styling */}
        <ResizableHandle withHandle className="bg-muted/30 hover:bg-muted/50 transition-colors" />
        
        {/* Right side - Slide content */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <SlideContent />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
