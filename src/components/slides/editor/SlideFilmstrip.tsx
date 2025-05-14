
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSlideEditor } from "./SlideEditorContext";

export const SlideFilmstrip: React.FC = () => {
  const {
    slides,
    currentSlideIndex,
    goToSlide,
    deleteSlideFromFilmstrip,
    goToNextSlide,
    goToPrevSlide
  } = useSlideEditor();

  // Reference for the filmstrip container
  const filmstripRef = useRef<HTMLDivElement>(null);
  
  // States for scroll navigation controls
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  // Function to check scroll possibilities
  const updateScrollButtons = () => {
    if (!filmstripRef.current) return;
    
    const container = filmstripRef.current;
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 2 // Adding a small buffer
    );
  };
  
  // Function to manually scroll the filmstrip
  const scrollFilmstrip = (direction: 'left' | 'right') => {
    if (!filmstripRef.current) return;
    
    const container = filmstripRef.current;
    const scrollAmount = container.clientWidth * 0.5; // Scroll half the container width
    
    const targetScrollLeft = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    });
  };
  
  // Center the current slide whenever it changes
  useEffect(() => {
    if (!filmstripRef.current) return;
    
    // Longer delay to ensure DOM is fully updated
    setTimeout(() => {
      try {
        // Find the current slide element using data attribute
        const currentSlideElement = filmstripRef.current?.querySelector(`[data-slide-index="${currentSlideIndex}"]`) as HTMLElement;
        if (!currentSlideElement) {
          console.warn(`Could not find slide element with index ${currentSlideIndex}`);
          return;
        }
        
        // Calculate the position to center the slide in the viewport
        const filmstripWidth = filmstripRef.current.offsetWidth;
        const slideWidth = currentSlideElement.offsetWidth;
        const slideOffset = currentSlideElement.offsetLeft;
        
        // Calculate the scroll position that will center the slide
        const scrollPosition = slideOffset - (filmstripWidth / 2) + (slideWidth / 2);
        
        console.log(`Centering slide ${currentSlideIndex}:`, {
          filmstripWidth,
          slideWidth,
          slideOffset,
          scrollPosition
        });
        
        // Use smooth scrolling to center the current slide
        filmstripRef.current.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
        
        // Update scroll buttons after centering
        setTimeout(updateScrollButtons, 300);
      } catch (error) {
        console.error("Error centering slide:", error);
      }
    }, 150); // Increased delay to ensure DOM updates are complete
    
  }, [currentSlideIndex]);
  
  // Update scroll buttons on scroll
  useEffect(() => {
    const container = filmstripRef.current;
    if (!container) return;
    
    const handleScroll = () => updateScrollButtons();
    
    container.addEventListener('scroll', handleScroll);
    // Initial check
    updateScrollButtons();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Handle keyboard navigation for previous/next slide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        // Don't capture arrow keys when in text fields
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextSlide();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToPrevSlide, goToNextSlide]);

  return (
    <div className="h-40 border-t w-full flex-shrink-0 overflow-hidden relative">
      <div className="w-full mx-auto px-4 h-full flex items-center relative">
        {/* Left scroll button */}
        <Button
          variant="outline"
          size="icon"
          className="absolute left-2 z-10 rounded-full opacity-80 hover:opacity-100 bg-background/80 backdrop-blur-sm"
          onClick={() => scrollFilmstrip('left')}
          disabled={!canScrollLeft}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Scroll left</span>
        </Button>
        
        {/* Custom scroll container */}
        <div 
          ref={filmstripRef} 
          className="flex gap-3 p-3 h-full overflow-x-auto scroll-smooth hide-scrollbar w-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {slides.map((slide, index) => (
            <div 
              key={slide.id}
              data-slide-index={index}
              onClick={() => goToSlide(index)}
              className={`h-full w-48 flex-shrink-0 cursor-pointer flex flex-col items-center justify-center relative group ${
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
        
        {/* Right scroll button */}
        <Button
          variant="outline"
          size="icon"
          className="absolute right-2 z-10 rounded-full opacity-80 hover:opacity-100 bg-background/80 backdrop-blur-sm"
          onClick={() => scrollFilmstrip('right')}
          disabled={!canScrollRight}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Scroll right</span>
        </Button>
      </div>
    </div>
  );
};
