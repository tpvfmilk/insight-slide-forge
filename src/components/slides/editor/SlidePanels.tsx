
import React from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { SlideImageGallery } from "./SlideImageGallery";
import { SlideContent } from "./SlideContent";

export const SlidePanels: React.FC = () => {
  return (
    <div className="w-full h-full p-4">
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
        {/* Left side - Slide content */}
        <ResizablePanel defaultSize={60} minSize={40}>
          <SlideContent />
        </ResizablePanel>
        
        {/* Resizable handle */}
        <ResizableHandle />
        
        {/* Right side - Images */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <SlideImageGallery />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
