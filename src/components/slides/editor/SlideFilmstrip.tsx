
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

  // References for drag-to-scroll functionality
  const filmstripRef = useRef<HTMLDivElement>(null);
  
  // Set up enhanced drag-to-scroll functionality for the filmstrip
  useEffect(() => {
    const filmstrip = filmstripRef.current;
    if (!filmstrip) return;
    
    let isDown = false;
    let startX: number;
    let scrollLeft: number;
    
    // Helper function to apply cursor styling
    const setCursorGrabbing = (grabbing = true) => {
      filmstrip.style.cursor = grabbing ? 'grabbing' : 'grab';
      filmstrip.style.userSelect = grabbing ? 'none' : '';
    };
    
    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      isDown = true;
      filmstrip.classList.add('active-drag');
      startX = e.pageX - filmstrip.offsetLeft;
      scrollLeft = filmstrip.scrollLeft;
      setCursorGrabbing(true);
    };
    
    const handleMouseUp = () => {
      isDown = false;
      filmstrip.classList.remove('active-drag');
      setCursorGrabbing(false);
    };
    
    const handleMouseLeave = () => {
      isDown = false;
      filmstrip.classList.remove('active-drag');
      setCursorGrabbing(false);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - filmstrip.offsetLeft;
      const walk = (x - startX) * 1.5; // Adjusted scroll speed
      
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        filmstrip.scrollLeft = scrollLeft - walk;
      });
    };
    
    // Touch event handlers for mobile devices
    const handleTouchStart = (e: TouchEvent) => {
      isDown = true;
      filmstrip.classList.add('active-drag');
      startX = e.touches[0].pageX - filmstrip.offsetLeft;
      scrollLeft = filmstrip.scrollLeft;
    };
    
    const handleTouchEnd = () => {
      isDown = false;
      filmstrip.classList.remove('active-drag');
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.touches[0].pageX - filmstrip.offsetLeft;
      const walk = (x - startX) * 1.5; // Adjusted scroll speed
      
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        filmstrip.scrollLeft = scrollLeft - walk;
      });
    };
    
    // Add event listeners with passive option for better performance
    filmstrip.addEventListener('mousedown', handleMouseDown);
    filmstrip.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    document.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.addEventListener('mousemove', handleMouseMove);
    
    // Add touch event listeners for mobile
    filmstrip.addEventListener('touchstart', handleTouchStart, { passive: true });
    filmstrip.addEventListener('touchend', handleTouchEnd, { passive: true });
    filmstrip.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    // Initialize cursor style
    setCursorGrabbing(false);
    
    return () => {
      // Clean up event listeners
      filmstrip.removeEventListener('mousedown', handleMouseDown);
      filmstrip.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
      
      // Clean up touch event listeners
      filmstrip.removeEventListener('touchstart', handleTouchStart);
      filmstrip.removeEventListener('touchend', handleTouchEnd);
      filmstrip.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Center the current slide whenever it changes
  useEffect(() => {
    if (!filmstripRef.current) return;
    
    // Get the current slide element using the index
    const slideElements = filmstripRef.current.children;
    if (!slideElements || slideElements.length === 0) return;
    
    const currentSlideElement = slideElements[currentSlideIndex] as HTMLElement;
    if (!currentSlideElement) return;
    
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
    
  }, [currentSlideIndex]);

  return (
    <div className="h-40 border-t w-full flex-shrink-0 overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-4 h-full">
        <ScrollArea orientation="horizontal" className="h-full w-full">
          <div 
            ref={filmstripRef} 
            className="flex gap-3 p-3 h-full cursor-grab"
            style={{ scrollbarWidth: 'none', touchAction: 'pan-x' }}
          >
            {slides.map((slide, index) => (
              <div 
                key={slide.id}
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
