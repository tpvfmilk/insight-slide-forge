
import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { useSlideEditor } from "./SlideEditorContext";

export const SlideFilmstrip: React.FC = () => {
  const {
    slides,
    currentSlideIndex,
    goToSlide,
    deleteSlideFromFilmstrip
  } = useSlideEditor();

  // Reference for the filmstrip container
  const filmstripRef = useRef<HTMLDivElement>(null);
  
  // Center the current slide whenever it changes
  useEffect(() => {
    if (!filmstripRef.current) return;
    
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      // Find the current slide element using data attribute
      const currentSlideElement = filmstripRef.current?.querySelector(`[data-slide-index="${currentSlideIndex}"]`) as HTMLElement;
      if (!currentSlideElement) {
        console.log(`Could not find slide element with index ${currentSlideIndex}`);
        return;
      }
      
      // Calculate the position to center the slide in the viewport
      const filmstripWidth = filmstripRef.current.offsetWidth;
      const slideWidth = currentSlideElement.offsetWidth;
      const slideOffset = currentSlideElement.offsetLeft;
      
      // Calculate the scroll position that will center the slide
      const scrollPosition = slideOffset - (filmstripWidth / 2) + (slideWidth / 2);
      
      // Use smooth scrolling to center the current slide
      filmstripRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }, 100); // Small delay to ensure DOM updates are complete
    
  }, [currentSlideIndex]);

  return (
    <div className="h-40 border-t w-full flex-shrink-0 overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-4 h-full">
        <ScrollArea orientation="horizontal" className="h-full w-full">
          <div 
            ref={filmstripRef} 
            className="flex gap-3 p-3 h-full"
            style={{ scrollbarWidth: 'none' }}
          >
            {slides.map((slide, index) => (
              <div 
                key={slide.id}
                data-slide-index={index}
                onClick={() => goToSlide(index)}
                className={`h-full w-48 flex-shrink-0 cursor-pointer flex flex-col items-center justify-center relative ${
                  currentSlideIndex === index ? "border-2 border-primary" : "border border-border hover:border-muted-foreground/30"
                } rounded-md overflow-hidden shadow-sm bg-card p-3`}
              >
                {/* Delete button in the top-right corner */}
                <Button
                  variant="ghost" 
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-opacity"
                  onClick={(e) => deleteSlideFromFilmstrip(e, index)}
                  disabled={slides.length <= 1}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Delete slide</span>
                </Button>

                {/* Slide title centered with text wrap */}
                <div className="text-xs text-center overflow-hidden">
                  <span className="font-medium">
                    {index + 1}. {slide.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
