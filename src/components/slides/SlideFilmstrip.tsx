
import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Slide } from "@/hooks/useSlides";

interface SlideFilmstripProps {
  slides: any[];
  currentSlideIndex: number;
  onSlideSelect: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onExportOptions: () => void;
  onDeleteCurrentSlide: () => void;
}

export const SlideFilmstrip = ({
  slides,
  currentSlideIndex,
  onSlideSelect,
  onAddSlide,
  onDeleteSlide,
  onNextSlide,
  onPrevSlide,
  onExportOptions,
  onDeleteCurrentSlide
}: SlideFilmstripProps) => {
  // References for drag-to-scroll functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMouseDown = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const scrollLeft = useRef<number>(0);
  
  // Set up drag-to-scroll functionality for the filmstrip
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    
    // Cast scrollContainer to HTMLElement to fix TypeScript errors
    const scrollContainerHtml = scrollContainer as HTMLElement;
    
    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown.current = true;
      startX.current = e.pageX - scrollContainerHtml.getBoundingClientRect().left;
      scrollLeft.current = scrollContainerHtml.scrollLeft;
      scrollContainerHtml.style.cursor = 'grabbing';
      scrollContainerHtml.style.userSelect = 'none';
    };
    
    const handleMouseUp = () => {
      isMouseDown.current = false;
      scrollContainerHtml.style.cursor = 'grab';
      scrollContainerHtml.style.userSelect = '';
    };
    
    const handleMouseLeave = () => {
      isMouseDown.current = false;
      scrollContainerHtml.style.cursor = 'grab';
      scrollContainerHtml.style.userSelect = '';
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return;
      e.preventDefault();
      const x = e.pageX - scrollContainerHtml.getBoundingClientRect().left;
      const walk = (x - startX.current) * 2; // Scroll speed multiplier
      scrollContainerHtml.scrollLeft = scrollLeft.current - walk;
    };
    
    // Add event listeners
    scrollContainerHtml.addEventListener('mousedown', handleMouseDown);
    scrollContainerHtml.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    
    // Initialize cursor style
    scrollContainerHtml.style.cursor = 'grab';
    
    return () => {
      // Clean up event listeners
      scrollContainerHtml.removeEventListener('mousedown', handleMouseDown);
      scrollContainerHtml.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  return (
    <div className="border-t w-full overflow-hidden">
      {/* Reduced height of this navigation bar */}
      <div className="border-b py-1.5 px-4 flex justify-between items-center">
        <div className="flex-1">
          {/* Empty space to balance the layout */}
        </div>
        
        <div className="flex items-center gap-2 flex-1 justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onPrevSlide}
            disabled={currentSlideIndex <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm px-1">
            {currentSlideIndex + 1} / {slides.length}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onNextSlide}
            disabled={currentSlideIndex >= slides.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button size="sm" variant="outline" className="h-8" onClick={onAddSlide}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        
        {/* Right-aligned export and delete buttons */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <Button size="sm" variant="outline" className="h-8" onClick={onExportOptions}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          
          <Button size="sm" variant="destructive" className="h-8" onClick={onDeleteCurrentSlide} disabled={slides.length <= 1}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
      
      {/* Filmstrip with constrained width and proper horizontal scrolling */}
      <div className="px-4 py-2 overflow-hidden w-full">
        <ScrollArea 
          className="h-16 border rounded-md" 
          orientation="horizontal" 
          ref={scrollContainerRef}
        >
          <div className="flex gap-2 p-2 w-max">
            {slides.map((slide, index) => (
              <div 
                key={slide.id || index}
                className={cn(
                  "group relative min-w-[140px] w-[140px] h-12 p-1 border rounded-md cursor-pointer transition-all duration-200 flex items-center justify-center flex-shrink-0",
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
                  "text-xs truncate text-center max-w-[110px] px-1",
                  index === currentSlideIndex ? "text-primary font-medium" : "text-foreground"
                )}>
                  {slide.title || "Untitled Slide"}
                </p>
                
                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity p-0",
                    index === currentSlideIndex && "text-primary"
                  )}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent slide selection when deleting
                    onDeleteSlide(index);
                  }}
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
