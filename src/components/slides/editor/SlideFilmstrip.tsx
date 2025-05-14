
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { useSlideEditor } from "./SlideEditorContext";
import { Card, CardContent } from "@/components/ui/card";

export const SlideFilmstrip: React.FC = () => {
  const {
    slides,
    currentSlideIndex,
    goToSlide,
    deleteSlideFromFilmstrip
  } = useSlideEditor();

  // References for drag-to-scroll functionality
  const filmstripRef = useRef<HTMLDivElement>(null);
  
  // Track drag vs click state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  
  // Set up enhanced drag-to-scroll functionality for the filmstrip
  useEffect(() => {
    const filmstrip = filmstripRef.current;
    if (!filmstrip) return;
    
    let isDown = false;
    let startX: number;
    let scrollLeft: number;
    let hasMoved = false;
    
    // Helper function to apply cursor styling
    const setCursorGrabbing = (grabbing = true) => {
      filmstrip.style.cursor = grabbing ? 'grabbing' : 'grab';
      filmstrip.style.userSelect = grabbing ? 'none' : '';
    };
    
    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      // Check if the click was on a button or interactive element
      if ((e.target as Element).closest('button') || 
          (e.target as Element).closest('[role="button"]')) {
        return;
      }
      
      isDown = true;
      hasMoved = false;
      filmstrip.classList.add('active-drag');
      startX = e.pageX - filmstrip.offsetLeft;
      scrollLeft = filmstrip.scrollLeft;
      setCursorGrabbing(true);
      
      // Track the starting position to determine if this is a click or drag
      dragStartPos.current = { x: e.pageX, y: e.pageY };
      setIsDragging(true);
    };
    
    const handleMouseUp = () => {
      isDown = false;
      filmstrip.classList.remove('active-drag');
      setCursorGrabbing(false);
      
      // Reset dragging state after a small timeout to allow click events to fire
      setTimeout(() => {
        setIsDragging(false);
        dragStartPos.current = null;
      }, 10);
    };
    
    const handleMouseLeave = () => {
      isDown = false;
      filmstrip.classList.remove('active-drag');
      setCursorGrabbing(false);
      
      // Reset dragging state
      setIsDragging(false);
      dragStartPos.current = null;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      
      // Check if we've moved enough to consider this a drag
      if (dragStartPos.current) {
        const moveX = Math.abs(e.pageX - dragStartPos.current.x);
        const moveY = Math.abs(e.pageY - dragStartPos.current.y);
        
        if (moveX > 5 || moveY > 5) {
          hasMoved = true;
        }
      }
      
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
      if ((e.target as Element).closest('button') || 
          (e.target as Element).closest('[role="button"]')) {
        return;
      }
      
      isDown = true;
      hasMoved = false;
      filmstrip.classList.add('active-drag');
      startX = e.touches[0].pageX - filmstrip.offsetLeft;
      scrollLeft = filmstrip.scrollLeft;
      
      // Track the starting position
      dragStartPos.current = { x: e.touches[0].pageX, y: e.touches[0].pageY };
      setIsDragging(true);
    };
    
    const handleTouchEnd = () => {
      isDown = false;
      filmstrip.classList.remove('active-drag');
      
      // Reset dragging state after a small timeout to allow click events to fire
      setTimeout(() => {
        setIsDragging(false);
        dragStartPos.current = null;
      }, 10);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDown) return;
      
      // Check if we've moved enough to consider this a drag
      if (dragStartPos.current) {
        const moveX = Math.abs(e.touches[0].pageX - dragStartPos.current.x);
        const moveY = Math.abs(e.touches[0].pageY - dragStartPos.current.y);
        
        if (moveX > 5 || moveY > 5) {
          hasMoved = true;
        }
      }
      
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

  // Handler for card click that checks if we're currently dragging
  const handleCardClick = (index: number) => {
    if (!isDragging || !dragStartPos.current) {
      goToSlide(index);
    }
  };

  return (
    <div className="h-40 border-t w-full flex-shrink-0 overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-4 h-full">
        <ScrollArea orientation="horizontal" className="h-full w-full">
          <div 
            ref={filmstripRef} 
            className="filmstrip-container flex gap-3 p-3 h-full"
            style={{ scrollbarWidth: 'none', touchAction: 'pan-x' }}
          >
            {slides.map((slide, index) => (
              <Card 
                key={slide.id}
                className={`filmstrip-card h-full w-48 flex-shrink-0 relative ${
                  currentSlideIndex === index ? "ring-2 ring-primary" : "border border-border hover:border-muted-foreground/30"
                } rounded-md overflow-hidden shadow-sm`}
              >
                <CardContent className="p-3 h-full flex flex-col items-center justify-center">
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
                  <div 
                    className="text-xs text-center overflow-hidden w-full"
                    onClick={() => handleCardClick(index)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="font-medium">
                      {index + 1}. {slide.title}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
