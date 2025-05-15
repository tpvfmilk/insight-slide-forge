import { useState, useEffect } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

export interface SlideData {
  id?: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
  imageUrls?: string[];
  transcript?: string;
  transcriptTimestamps?: string[];
  [key: string]: any;
}

interface SlidePreviewProps {
  slides: SlideData[];
  currentSlide: number;
  onSlideClick?: (index: number) => void;
  onRemoveSlide?: (index: number) => void;
  isEditable?: boolean;
  className?: string;
}

export function SlidePreview({ 
  slides, 
  currentSlide, 
  onSlideClick, 
  onRemoveSlide,
  isEditable = true,
  className = "",
}: SlidePreviewProps) {
  const isMobile = useIsMobile();
  
  const [activeIndex, setActiveIndex] = useState(currentSlide);
  
  // Update active state when currentSlide changes in parent
  useEffect(() => {
    setActiveIndex(currentSlide);
  }, [currentSlide]);

  const handleSlideClick = (index: number) => {
    setActiveIndex(index);
    if (onSlideClick) {
      onSlideClick(index);
    }
  };
  
  return (
    <div className={cn("flex flex-col h-full p-2", className)}>
      <ScrollArea className="h-full w-full p-1">
        <div className="space-y-2">
          {slides.map((slide, index) => (
            <div
              key={slide.id || index}
              className={cn(
                "group relative p-3 border rounded-md cursor-pointer transition-all duration-200",
                index === activeIndex 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-muted-foreground"
              )}
              onClick={() => handleSlideClick(index)}
            >
              {/* Slide Number Badge */}
              <Badge 
                variant="outline" 
                className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-background"
              >
                {index + 1}
              </Badge>

              {/* Slide Content */}
              <div className="space-y-1 text-sm">
                {/* Title */}
                <h3 
                  className={cn(
                    "font-medium line-clamp-1", 
                    index === activeIndex ? "text-primary" : "text-foreground"
                  )}
                >
                  {slide.title || "Untitled Slide"}
                </h3>
                
                {/* Text Content */}
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {slide.content || "No content"}
                </p>
                
                {/* Image Preview */}
                {(slide.imageUrl || (slide.imageUrls && slide.imageUrls.length > 0)) && (
                  <div className="w-full flex justify-center">
                    <div className="relative h-16 aspect-video bg-muted/50 rounded overflow-hidden">
                      {slide.imageUrl ? (
                        <img 
                          src={slide.imageUrl} 
                          alt={`Slide ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : slide.imageUrls && slide.imageUrls.length > 0 ? (
                        <img 
                          src={slide.imageUrls[0]} 
                          alt={`Slide ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <ImageIcon size={24} />
                        </div>
                      )}
                      
                      {/* Show indicator for multiple images */}
                      {slide.imageUrls && slide.imageUrls.length > 1 && (
                        <Badge 
                          variant="secondary"
                          className="absolute bottom-1 right-1 text-xs"
                        >
                          {slide.imageUrls.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Timestamp if available */}
              {slide.timestamp && (
                <div className="text-xs text-muted-foreground mt-1">
                  {slide.timestamp}
                </div>
              )}
              
              {/* Remove button */}
              {isEditable && onRemoveSlide && !isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity",
                    index === activeIndex && "text-primary"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSlide(index);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          
          {/* Empty state */}
          {slides.length === 0 && (
            <div className="flex items-center justify-center py-8 text-center text-muted-foreground flex-col space-y-2">
              <div className="border border-dashed rounded-md p-6 w-full">
                <p>No slides yet</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Total slide count indicator */}
      <div className="pt-2 text-xs text-muted-foreground text-center border-t mt-2">
        {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
      </div>
    </div>
  );
}
