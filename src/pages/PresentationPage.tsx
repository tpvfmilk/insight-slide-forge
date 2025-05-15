import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProjectById } from "@/services/projectService";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, X, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slide } from "@/components/slides/editor/SlideEditorTypes";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideTransition } from "@/components/slides/SlideTransition";

const PresentationPage = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const presentationRef = useRef<HTMLDivElement>(null);
  const [nextSlidePreloaded, setNextSlidePreloaded] = useState<number | null>(null);
  
  // Get current slide
  const currentSlide = slides[currentSlideIndex];
  
  // Preload next slide for smoother transitions
  useEffect(() => {
    if (currentSlideIndex < slides.length - 1) {
      setNextSlidePreloaded(currentSlideIndex + 1);
    } else {
      setNextSlidePreloaded(null);
    }
  }, [currentSlideIndex, slides.length]);
  
  // Handler for keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      goToNextSlide();
    } else if (e.key === "ArrowLeft") {
      goToPrevSlide();
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen();
    } else if (e.key === "Escape" && isFullscreen) {
      exitFullscreen();
    }
  }, [currentSlideIndex, slides.length, isFullscreen]);
  
  // Navigation functions
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

  // Fullscreen functions
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  };

  const enterFullscreen = () => {
    const element = presentationRef.current;
    if (!element) return;

    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen();
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  // Handle fullscreen change events
  const handleFullscreenChange = () => {
    setIsFullscreen(
      !!document.fullscreenElement || !!(document as any).webkitFullscreenElement
    );
  };
  
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
          // Type assertion with unknown first to fix the type error
          setSlides((project.slides as unknown) as Slide[]);
        }
      } catch (error) {
        console.error("Error loading project data:", error);
        toast.error("Failed to load presentation data");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProjectInfo();
    
    // Add keyboard event listeners
    window.addEventListener("keydown", handleKeyDown);
    
    // Add fullscreen change event listeners
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    
    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [projectId, handleKeyDown]);
  
  return (
    <div 
      ref={presentationRef}
      className={`min-h-screen flex flex-col bg-black text-white ${isFullscreen ? 'fullscreen-mode' : ''}`}
    >
      {/* Header */}
      <PresentationHeader 
        projectTitle={projectTitle} 
        projectId={projectId || ""} 
        isLoading={isLoading}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
      />
      
      {/* Main Content - Updated to center content in fullscreen mode */}
      <div className={`flex-1 flex items-center justify-center ${isFullscreen ? 'p-1' : 'p-2'} overflow-hidden`}>
        {isLoading ? (
          <PresentationSkeleton />
        ) : slides.length > 0 ? (
          <SlideTransition slide={currentSlide} isFullscreen={isFullscreen}>
            <PresentationSlide slide={currentSlide} isFullscreen={isFullscreen} />
          </SlideTransition>
        ) : (
          <div className="text-center p-8">
            <h2 className="text-2xl font-semibold mb-4">No slides available</h2>
            <p className="text-gray-400">Return to the editor to create slides for this presentation.</p>
          </div>
        )}
      </div>
      
      {/* Footer Controls */}
      {!isLoading && slides.length > 0 && (
        <PresentationControls 
          currentSlideIndex={currentSlideIndex}
          totalSlides={slides.length}
          goToPrevSlide={goToPrevSlide}
          goToNextSlide={goToNextSlide}
          isFullscreen={isFullscreen}
        />
      )}

      {/* Fixed global styles for fullscreen mode - Updated for vertical centering */}
      <style>
        {`
          .fullscreen-mode {
            width: 100vw;
            height: 100vh;
          }
          .fullscreen-mode .presentation-slide-container {
            max-width: 98% !important;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          
          /* Preload hidden images to prevent layout shifts */
          .preload-image {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
          }
        `}
      </style>
      
      {/* Preload next slide images */}
      {nextSlidePreloaded !== null && slides[nextSlidePreloaded] && (
        <div className="hidden">
          {/* Preload next slide images */}
          {slides[nextSlidePreloaded].imageUrl && (
            <img src={slides[nextSlidePreloaded].imageUrl} className="preload-image" alt="" />
          )}
          {slides[nextSlidePreloaded].imageUrls?.map((url, i) => (
            <img key={`preload-${i}`} src={url} className="preload-image" alt="" />
          ))}
        </div>
      )}
    </div>
  );
};

// Presentation Header Component
const PresentationHeader: React.FC<{
  projectTitle: string;
  projectId: string;
  isLoading: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}> = ({ projectTitle, projectId, isLoading, isFullscreen, toggleFullscreen }) => {
  return (
    <div className={`w-full px-4 py-2 bg-black/90 border-b border-white/10 flex items-center justify-between ${isFullscreen ? 'py-1' : ''}`}>
      <Button 
        variant="ghost" 
        size="sm" 
        asChild 
        className="text-white hover:bg-white/10"
      >
        <Link to={`/projects/${projectId}`}>
          <X className="h-4 w-4 mr-1" />
          Exit
        </Link>
      </Button>
      
      <div className="flex items-center space-x-3">
        {!isLoading && projectTitle && (
          <div className="text-sm font-medium text-white/80 truncate max-w-md">
            {projectTitle}
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="text-white hover:bg-white/10"
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

// Presentation Slide Component
const PresentationSlide: React.FC<{
  slide: Slide;
  isFullscreen: boolean;
}> = ({ slide, isFullscreen }) => {
  // Collect all images from both imageUrl and imageUrls
  const allImages: string[] = [];
  if (slide.imageUrl) allImages.push(slide.imageUrl);
  if (slide.imageUrls) allImages.push(...slide.imageUrls);
  
  const hasImages = allImages.length > 0;
  const hasSingleImage = allImages.length === 1;
  
  return (
    <div className={`w-full presentation-slide-container mx-auto ${isFullscreen ? 'max-w-[96%]' : 'max-w-7xl'}`}>
      {hasImages ? (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isFullscreen ? 'gap-3' : 'gap-4'} h-full`}>
          {/* Left side: Image(s) */}
          <div className="flex flex-col h-full justify-center">
            {hasSingleImage ? (
              // Single image - take full width of the container
              <div className="w-full h-full flex items-center">
                <div className="w-full rounded-md overflow-hidden border border-white/10">
                  <AspectRatio ratio={16/9}>
                    <img 
                      src={allImages[0]} 
                      alt="Slide image"
                      className="w-full h-full object-cover"
                    />
                  </AspectRatio>
                </div>
              </div>
            ) : (
              // Multiple images - use grid layout
              <div className={`grid grid-cols-2 ${isFullscreen ? 'gap-3' : 'gap-4'} h-full`}>
                {allImages.map((imageUrl, index) => (
                  <div key={index} className="relative h-full flex items-center">
                    <div className="w-full rounded-md overflow-hidden border border-white/10">
                      <AspectRatio ratio={16/9}>
                        <img 
                          src={imageUrl} 
                          alt={`Slide image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </AspectRatio>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Right side: Slide content */}
          <div className={`flex flex-col ${isFullscreen ? 'p-3' : 'p-4'} space-y-4 justify-center`}>
            <h2 className="text-2xl font-semibold">{slide.title}</h2>
            <div className="mt-2 whitespace-pre-wrap">{slide.content}</div>
          </div>
        </div>
      ) : (
        // No images - center the content
        <div className={`text-center ${isFullscreen ? 'p-4 max-w-3xl' : 'p-6 max-w-2xl'} mx-auto flex flex-col justify-center h-full`}>
          <h2 className="text-2xl font-semibold mb-4">{slide.title}</h2>
          <div className="mt-2 whitespace-pre-wrap">{slide.content}</div>
        </div>
      )}
    </div>
  );
};

// Presentation Controls Component
const PresentationControls: React.FC<{
  currentSlideIndex: number;
  totalSlides: number;
  goToPrevSlide: () => void;
  goToNextSlide: () => void;
  isFullscreen: boolean;
}> = ({ currentSlideIndex, totalSlides, goToPrevSlide, goToNextSlide, isFullscreen }) => {
  return (
    <div className={`w-full border-t border-white/10 bg-black/80 ${isFullscreen ? 'py-1 px-3' : 'py-2 px-4'}`}>
      <div className={`mx-auto flex items-center justify-between ${isFullscreen ? 'max-w-[96%]' : 'max-w-7xl'}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={goToPrevSlide}
          disabled={currentSlideIndex === 0}
          className="text-white border-white/30 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        
        <div className="flex items-center text-sm text-white/70">
          Slide {currentSlideIndex + 1} of {totalSlides}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextSlide}
          disabled={currentSlideIndex === totalSlides - 1}
          className="text-white border-white/30 hover:bg-white/10 hover:text-white"
        >
          Next
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// Loading skeleton placeholder
const PresentationSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="rounded-md overflow-hidden">
                <AspectRatio ratio={16/9}>
                  <Skeleton className="w-full h-full" />
                </AspectRatio>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
};

export default PresentationPage;
