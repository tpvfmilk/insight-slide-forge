
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Project, fetchProjectById } from "@/services/projectService";
import { toast } from "sonner";

interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
}

const SlideContent = ({ slide }: { slide: Slide }) => (
  <div className="space-y-6">
    <h2 className="text-4xl font-bold">{slide.title}</h2>
    {slide.imageUrl && (
      <div className="my-8">
        <img 
          src={slide.imageUrl} 
          alt={slide.title}
          className="mx-auto max-h-[50vh] object-contain"
        />
      </div>
    )}
    <div className="text-xl whitespace-pre-line overflow-y-auto max-h-[60vh] px-2 md:px-0">
      {slide.content}
    </div>
  </div>
);

function isValidSlideArray(data: any): data is Slide[] {
  return Array.isArray(data) && data.every(slide =>
    typeof slide.title === 'string' &&
    typeof slide.content === 'string'
  );
}

export const SlidePreview = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [project, setProject] = useState<Project | null>(null);

  const currentSlide = slides[currentSlideIndex];
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === ' ') {
      goToNextSlide();
    } else if (event.key === 'ArrowLeft') {
      goToPrevSlide();
    } else if (event.key === 'Escape') {
      exitPresentation();
    }
  }, [currentSlideIndex, slides.length]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  const exitPresentation = () => {
    navigate(`/projects/${projectId}`);
  };
  
  const goToNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };
  
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        const projectData = await fetchProjectById(projectId);
        setProject(projectData);
        
        if (projectData?.slides && isValidSlideArray(projectData.slides)) {
          if (projectData.slides.length > 0) {
            setSlides(projectData.slides);
          } else {
            toast.error("No slides available for presentation");
            exitPresentation();
          }
        } else {
          toast.error("Invalid slide format");
          exitPresentation();
        }
      } catch (error) {
        console.error("Error loading slides for presentation:", error);
        toast.error("Failed to load slides");
        exitPresentation();
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProject();
  }, [projectId]);
  
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
          <p className="text-sm">Loading presentation...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden flex flex-col">
      {/* Header with controls */}
      <div className="p-4 absolute top-0 left-0 right-0 z-10 flex justify-between items-center transition-opacity duration-300 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-sm opacity-70">
          {project?.title} • Slide {currentSlideIndex + 1} of {slides.length}
        </div>
        <Button variant="ghost" size="icon" onClick={exitPresentation} className="text-white hover:bg-white/10">
          <X className="h-5 w-5" />
          <span className="sr-only">Exit presentation</span>
        </Button>
      </div>
      
      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center p-8 animate-fade-in">
        <div className="max-w-4xl w-full">
          {currentSlide && <SlideContent slide={currentSlide} />}
        </div>
      </div>
      
      {/* Navigation controls */}
      <div className="p-6 absolute bottom-0 left-0 right-0 flex justify-between items-center transition-opacity duration-300 bg-gradient-to-t from-black/70 to-transparent">
        <Button 
          variant="ghost" 
          onClick={goToPrevSlide} 
          disabled={currentSlideIndex === 0}
          className="text-white disabled:opacity-30 hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Previous
        </Button>
        
        <div className="text-sm">
          {currentSlideIndex + 1} / {slides.length}
        </div>
        
        <Button 
          variant="ghost" 
          onClick={goToNextSlide} 
          disabled={currentSlideIndex === slides.length - 1}
          className="text-white disabled:opacity-30 hover:bg-white/10"
        >
          Next
          <ChevronRight className="h-5 w-5 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default SlidePreview;
