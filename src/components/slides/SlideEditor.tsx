
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { fetchProjectById, updateProject } from "@/services/projectService";
import { Button } from "@/components/ui/button";
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { debounce } from "lodash";
import { cn } from "@/lib/utils";

// Interface for SlideEditor props
interface SlideEditorProps {
  onDeleteSlide?: (index: number) => void;
  canUndo?: boolean;
}

export const SlideEditor = ({ onDeleteSlide, canUndo }: SlideEditorProps) => {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [slides, setSlides] = useState<any[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Get project data
  useEffect(() => {
    const getProject = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        const projectData = await fetchProjectById(projectId);
        
        if (!projectData) {
          toast.error("Project not found");
          return;
        }
        
        setProject(projectData);
        
        if (projectData.slides && Array.isArray(projectData.slides)) {
          setSlides(projectData.slides);
        } else {
          setSlides([]);
        }
      } catch (error) {
        console.error("Error loading project:", error);
        toast.error("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    };
    
    getProject();
  }, [projectId]);
  
  // Handle slide title update
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    updateSlide(currentSlideIndex, { title: value });
  };
  
  // Handle slide content update
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    updateSlide(currentSlideIndex, { content: value });
  };
  
  // Create a debounced save function to avoid too many saves
  const debouncedSave = useRef(
    debounce(async (updatedSlides: any[]) => {
      if (!projectId) return;
      
      try {
        setIsSaving(true);
        await updateProject(projectId, { slides: updatedSlides });
      } catch (error) {
        console.error("Error saving slides:", error);
      } finally {
        setIsSaving(false);
      }
    }, 2000)
  ).current;
  
  // Update a slide at a specific index
  const updateSlide = (index: number, updates: any) => {
    const updatedSlides = [...slides];
    updatedSlides[index] = {
      ...updatedSlides[index],
      ...updates,
      lastModified: new Date().toISOString(),
    };
    
    setSlides(updatedSlides);
    debouncedSave(updatedSlides);
  };
  
  // Add a new slide
  const handleAddSlide = () => {
    const newSlide = {
      title: `Slide ${slides.length + 1}`,
      content: "",
      lastModified: new Date().toISOString(),
    };
    
    const updatedSlides = [...slides, newSlide];
    setSlides(updatedSlides);
    setCurrentSlideIndex(updatedSlides.length - 1);
    debouncedSave(updatedSlides);
  };
  
  // Navigation between slides
  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };
  
  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };
  
  // Focus textarea when changing slides
  useEffect(() => {
    if (contentTextareaRef.current) {
      contentTextareaRef.current.focus();
    }
  }, [currentSlideIndex]);
  
  // Thumbnail click handler
  const handleThumbnailClick = (index: number) => {
    if (index !== currentSlideIndex) {
      setCurrentSlideIndex(index);
      // Remove notification to reduce toast fatigue
    }
  };
  
  // Add slide button component
  const AddSlideButton = () => {
    return (
      <div className="flex justify-center my-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddSlide}
          title="Add new slide"
          className="mx-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
        
        {/* Delete slide button */}
        {(slides?.length || 0) > 0 && onDeleteSlide && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDeleteSlide(currentSlideIndex)}
            title="Delete current slide"
            className="mx-2 text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          <div className="rounded-lg p-4 space-y-4 bg-muted/20">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-72 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // No slides state
  if (!slides || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 h-full">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-medium mb-2">No Slides Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This project doesn't have any slides. Add your first slide to get started.
          </p>
          <Button onClick={handleAddSlide}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Slide
          </Button>
        </div>
      </div>
    );
  }
  
  const currentSlide = slides[currentSlideIndex];
  
  return (
    <div className="p-4 h-full overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
        {/* Left column - Slide thumbnails and preview */}
        <div className="flex flex-col h-full">
          {/* Slide preview */}
          <div className="bg-muted/20 rounded-lg p-6 flex-grow flex flex-col">
            <h3 className="text-xl font-semibold mb-4">{currentSlide?.title || `Slide ${currentSlideIndex + 1}`}</h3>
            
            <div className="flex-grow">
              {currentSlide?.content && <p className="whitespace-pre-wrap">{currentSlide.content}</p>}
              {currentSlide?.imageUrl && (
                <div className="mt-4">
                  <img 
                    src={currentSlide.imageUrl} 
                    alt={currentSlide.title || `Slide ${currentSlideIndex + 1}`} 
                    className="max-h-64 rounded-md object-contain mx-auto" 
                  />
                </div>
              )}
            </div>
            
            {currentSlide?.timestamp && (
              <div className="mt-auto pt-4 flex items-center text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                <span>Timestamp: {currentSlide.timestamp}</span>
              </div>
            )}
          </div>
          
          {/* Thumbnail navigation */}
          <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={cn(
                  "cursor-pointer rounded border border-transparent p-1 transition-all hover:border-primary",
                  index === currentSlideIndex && "border-primary bg-primary/10"
                )}
                onClick={() => handleThumbnailClick(index)}
              >
                <div className="h-20 bg-muted/40 rounded flex items-center justify-center">
                  {slide?.imageUrl ? (
                    <img 
                      src={slide.imageUrl} 
                      alt={`Thumbnail ${index + 1}`} 
                      className="max-h-full max-w-full object-contain rounded" 
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <AddSlideButton />
        </div>
        
        {/* Right column - Slide editing */}
        <div className="flex flex-col h-full">
          <div className="space-y-4 flex-grow">
            {/* Title input */}
            <div>
              <label htmlFor="slide-title" className="text-sm font-medium mb-1 block">
                Slide Title
              </label>
              <input
                id="slide-title"
                type="text"
                value={currentSlide?.title || ""}
                onChange={handleTitleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter slide title"
              />
            </div>
            
            {/* Content textarea */}
            <div className="flex-grow flex flex-col">
              <label htmlFor="slide-content" className="text-sm font-medium mb-1 block">
                Slide Content
              </label>
              <textarea
                id="slide-content"
                ref={contentTextareaRef}
                value={currentSlide?.content || ""}
                onChange={handleContentChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary flex-grow min-h-[200px]"
                placeholder="Enter slide content..."
              />
            </div>
          </div>
          
          {/* Navigation controls */}
          <div className="flex justify-between items-center mt-4">
            <Button 
              variant="outline" 
              onClick={handlePrevSlide} 
              disabled={currentSlideIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <div className="text-sm">
              {isSaving ? (
                <span className="text-muted-foreground animate-pulse">Saving...</span>
              ) : (
                <span className="text-muted-foreground">
                  Slide {currentSlideIndex + 1} of {slides.length}
                </span>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={handleNextSlide} 
              disabled={currentSlideIndex === slides.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
