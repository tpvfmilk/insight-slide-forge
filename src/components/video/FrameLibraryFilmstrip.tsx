
import React, { useRef, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2 } from "lucide-react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { Card, CardContent } from "@/components/ui/card";

interface FrameLibraryFilmstripProps {
  libraryFrames: ExtractedFrame[];
  selectedFrames: {[key: string]: boolean};
  toggleFrameSelection: (frame: ExtractedFrame) => void;
  removeFrame: (frameId: string) => void;
}

export const FrameLibraryFilmstrip: React.FC<FrameLibraryFilmstripProps> = ({
  libraryFrames,
  selectedFrames,
  toggleFrameSelection,
  removeFrame
}) => {
  // Reference for drag-to-scroll functionality
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
  const handleCardClick = (frame: ExtractedFrame) => {
    if (!isDragging || !dragStartPos.current) {
      toggleFrameSelection(frame);
    }
  };
  
  if (libraryFrames.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>No frames in library</p>
          <p className="text-sm mt-2">Capture frames from the video to add them to the library</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={filmstripRef} 
      className="filmstrip-container flex gap-3 p-3 h-full overflow-x-auto"
      style={{ scrollbarWidth: 'none', touchAction: 'pan-x' }}
    >
      {libraryFrames.map((frame) => (
        <Card 
          key={frame.id} 
          className={`filmstrip-card flex-shrink-0 ${
            selectedFrames[frame.id!] ? 'ring-2 ring-primary' : ''
          } hover:shadow-md transition-all`}
          style={{ width: '160px' }}
        >
          <CardContent className="p-0 relative">
            <div 
              className="relative"
              onClick={() => handleCardClick(frame)}
              style={{ cursor: 'pointer' }}
            >
              <img
                src={frame.imageUrl}
                alt={`Frame at ${frame.timestamp}`}
                className="object-cover w-full"
                style={{ height: '100px' }}
                draggable={false}
              />
              <Badge className="absolute top-1 left-1 text-xs">{frame.timestamp}</Badge>
              
              {selectedFrames[frame.id!] && (
                <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              
              <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6 absolute bottom-1 right-1 opacity-0 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFrame(frame.id as string);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
