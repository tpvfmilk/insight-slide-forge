
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useSlideEditor } from "./SlideEditorContext";

export const SlideControls: React.FC = () => {
  const { 
    currentSlideIndex,
    slides,
    goToPrevSlide,
    goToNextSlide,
    addNewSlide,
    deleteCurrentSlide
  } = useSlideEditor();

  return (
    <div className="border-t p-3 flex items-center justify-between">
      {/* Left side - empty */}
      <div className="w-1/4"></div>
      
      {/* Center - navigation buttons */}
      <div className="flex items-center justify-center w-1/2 space-x-3">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPrevSlide}
          disabled={currentSlideIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1.5" />
          Previous
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={addNewSlide}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Slide
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextSlide}
          disabled={currentSlideIndex === slides.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
      
      {/* Right side - Delete button */}
      <div className="flex justify-end w-1/4">
        <Button
          variant="destructive"
          size="sm"
          onClick={deleteCurrentSlide}
          disabled={slides.length <= 1}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete Slide
        </Button>
      </div>
    </div>
  );
};
