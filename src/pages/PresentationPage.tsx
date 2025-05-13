
import { useEffect, useState, useCallback } from "react";
import { SlidePreview } from "@/components/slides/SlidePreview";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchProjectById } from "@/services/projectService";
import { toast } from "sonner";

const PresentationPage = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [slides, setSlides] = useState<any[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [hideControlsTimeout, setHideControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const loadProjectInfo = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        const project = await fetchProjectById(projectId);
        
        if (!project) {
          toast.error("Project not found");
          return;
        }

        setProjectTitle(project.title || "Untitled Presentation");
        
        // Check if slides exist
        if (!project.slides || !Array.isArray(project.slides) || project.slides.length === 0) {
          toast.error("No slides available for this project");
        } else {
          setSlides(project.slides);
        }
      } catch (error) {
        console.error("Error loading project data:", error);
        toast.error("Failed to load presentation data");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProjectInfo();
  }, [projectId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "Space") {
        goToNextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        goToPrevSlide();
      } else if (e.key === "Home") {
        setCurrentSlideIndex(0);
      } else if (e.key === "End") {
        setCurrentSlideIndex(slides.length - 1);
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "Escape" && isFullscreen) {
        exitFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, slides.length, isFullscreen]);

  // Auto-hide controls after inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setControlsVisible(true);
      
      // Clear existing timeout
      if (hideControlsTimeout) {
        clearTimeout(hideControlsTimeout);
      }
      
      // Set new timeout to hide controls after 3 seconds of inactivity
      const timeout = setTimeout(() => {
        if (isFullscreen) {
          setControlsVisible(false);
        }
      }, 3000);
      
      setHideControlsTimeout(timeout);
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideControlsTimeout) {
        clearTimeout(hideControlsTimeout);
      }
    };
  }, [isFullscreen, hideControlsTimeout]);

  const goToNextSlide = useCallback(() => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prevIndex => prevIndex + 1);
    }
  }, [currentSlideIndex, slides.length]);

  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prevIndex => prevIndex - 1);
    }
  }, [currentSlideIndex]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        toast.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      exitFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err}`);
      });
    }
  };
  
  return (
    <div className={`h-screen flex flex-col bg-black ${isFullscreen ? 'overflow-hidden' : ''}`}>
      {/* Top navigation bar - visible based on controlsVisible state */}
      <div className={`transition-opacity duration-300 absolute top-0 left-0 right-0 z-50 
        bg-black/70 text-white p-2 flex items-center justify-between 
        ${(!controlsVisible && isFullscreen) ? 'opacity-0' : 'opacity-100'}`}>
        <Button 
          variant="ghost" 
          size="sm" 
          asChild 
          className="text-white hover:bg-white/20"
        >
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Editor
          </Link>
        </Button>
        
        {!isLoading && (
          <div className="text-sm font-medium opacity-80 truncate max-w-md">
            {projectTitle} - Slide {currentSlideIndex + 1} of {slides.length}
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="text-white hover:bg-white/20"
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Main content area with slide */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative max-w-[90%] h-[90%] flex items-center justify-center">
          {/* Previous slide button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0}
            className={`absolute left-[-60px] text-white hover:bg-white/20 transition-opacity duration-300 
              ${(!controlsVisible && isFullscreen) || currentSlideIndex === 0 ? 'opacity-0' : 'opacity-100'}`}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          
          <div className="w-full h-full flex items-center justify-center">
            {/* The slide container with animation */}
            <div className="w-full h-full flex items-center justify-center animate-fade-in">
              <SlidePreview 
                slides={slides} 
                currentSlide={slides[currentSlideIndex]} 
              />
            </div>
          </div>
          
          {/* Next slide button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextSlide}
            disabled={currentSlideIndex === slides.length - 1}
            className={`absolute right-[-60px] text-white hover:bg-white/20 transition-opacity duration-300 
              ${(!controlsVisible && isFullscreen) || currentSlideIndex === slides.length - 1 ? 'opacity-0' : 'opacity-100'}`}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </div>
      </div>
      
      {/* Bottom slide navigation */}
      <div 
        className={`transition-opacity duration-300 absolute bottom-0 left-0 right-0 z-50 
          bg-black/70 text-white p-2 flex items-center justify-center gap-4
          ${(!controlsVisible && isFullscreen) ? 'opacity-0' : 'opacity-100'}`}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPrevSlide}
          disabled={currentSlideIndex === 0}
          className="text-white hover:bg-white/20"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        
        <div className="text-sm text-center">
          {currentSlideIndex + 1} / {slides.length}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextSlide}
          disabled={currentSlideIndex === slides.length - 1}
          className="text-white hover:bg-white/20"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default PresentationPage;
