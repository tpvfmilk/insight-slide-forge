
import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Slide } from "@/hooks/useSlides";

interface SlideFilmstripProps {
  slides: Slide[];
  currentSlideIndex: number;
  onSlideSelect: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (event: React.MouseEvent<Element, MouseEvent>, slideIndex: number) => void;
  onNextSlide: () => void;
  onPrevSlide: () => void;
}

export const SlideFilmstrip = ({
  slides,
  currentSlideIndex,
  onSlideSelect,
  onAddSlide,
  onDeleteSlide,
  onNextSlide,
  onPrevSlide,
}: SlideFilmstripProps) => {
  // References for drag-to-scroll functionality
  const filmstripRef = useRef<HTMLDivElement>(null);
  const isMouseDown = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const scrollLeft = useRef<number>(0);
  
  // Set up drag-to-scroll functionality for the filmstrip
  useEffect(() => {
    const filmstrip = filmstripRef.current;
    if (!filmstrip) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown.current = true;
      startX.current = e.pageX - filmstrip.offsetLeft;
      scrollLeft.current = filmstrip.scrollLeft;
      filmstrip.style.cursor = 'grabbing';
      filmstrip.style.userSelect = 'none';
    };
    
    const handleMouseUp = () => {
      isMouseDown.current = false;
      filmstrip.style.cursor = 'grab';
      filmstrip.style.userSelect = '';
    };
    
    const handleMouseLeave = () => {
      isMouseDown.current = false;
      filmstrip.style.cursor = 'grab';
      filmstrip.style.userSelect = '';
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return;
      e.preventDefault();
      const x = e.pageX - filmstrip.offsetLeft;
      const walk = (x - startX.current) * 2; // Scroll speed multiplier
      filmstrip.scrollLeft = scrollLeft.current - walk;
    };
    
    // Add event listeners
    filmstrip.addEventListener('mousedown', handleMouseDown);
    filmstrip.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    
    // Initialize cursor style
    filmstrip.style.cursor = 'grab';
    
    return () => {
      // Clean up event listeners
      filmstrip.removeEventListener('mousedown', handleMouseDown);
      filmstrip.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  return (
    <div className="border-t pt-4">
      {/* Navigation controls above filmstrip */}
      <div className="flex items-center justify-center mb-2 gap-2">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onPrevSlide}
          disabled={currentSlideIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onAddSlide}
          className="px-2"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Slide
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onNextSlide}
          disabled={currentSlideIndex >= slides.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Filmstrip */}
      <ScrollArea className="h-24 border rounded-md" ref={filmstripRef}>
        <div className="flex gap-2 p-2 min-w-full">
          {slides.map((slide, index) => (
            <div 
              key={slide.id || index}
              className={cn(
                "group relative min-w-[160px] h-16 p-2 border rounded-md cursor-pointer transition-all duration-200 flex items-center justify-center",
                index === currentSlideIndex 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-muted-foreground"
              )}
              onClick={() => onSlideSelect(index)}
            >
              {/* Slide Number Badge */}
              <Badge 
                variant="outline" 
                className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-background"
              >
                {index + 1}
              </Badge>
              
              {/* Only show the slide title */}
              <p className={cn(
                "text-sm truncate text-center",
                index === currentSlideIndex ? "text-primary font-medium" : "text-foreground"
              )}>
                {slide.title || "Untitled Slide"}
              </p>
              
              {/* Remove button */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity",
                  index === currentSlideIndex && "text-primary"
                )}
                onClick={(e) => onDeleteSlide(e, index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
