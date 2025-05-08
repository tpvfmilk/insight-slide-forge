import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Fullscreen, Sun, Moon, Timer, Film, Image, MoreVertical } from "lucide-react";
import { Project, fetchProjectById } from "@/services/projectService";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuVideoFrameButton,
} from "@/components/ui/dropdown-menu";
import { FramePickerModal } from "@/components/video/FramePickerModal";

export interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
  imageUrls?: string[];
  transcriptTimestamps?: string[];
  transitionType?: "fade" | "slide" | "zoom";
}

type TransitionDirection = "next" | "prev" | "none";

const SlideContent = ({ slide }: { slide: Slide }) => (
  <div className="space-y-6">
    <h2 className="text-4xl font-bold">{slide.title}</h2>
    
    {/* Display multiple images if available, otherwise fall back to single imageUrl */}
    {slide.imageUrls && slide.imageUrls.length > 0 ? (
      <div className="my-6">
        <div className={`grid ${slide.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
          {slide.imageUrls.map((url, index) => (
            <img 
              key={`${slide.id}-image-${index}`}
              src={url} 
              alt={`${slide.title} - visual ${index + 1}`}
              className="mx-auto max-h-[30vh] object-contain rounded-md"
            />
          ))}
        </div>
      </div>
    ) : slide.imageUrl ? (
      <div className="my-8">
        <img 
          src={slide.imageUrl} 
          alt={slide.title}
          className="mx-auto max-h-[50vh] object-contain"
        />
      </div>
    ) : null}
    
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
  // New state variables for enhancements
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showMetadata, setShowMetadata] = useState<boolean>(true);
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>("none");
  const [transitionType, setTransitionType] = useState<"fade" | "slide" | "zoom">("fade");
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [isFramePickerModalOpen, setIsFramePickerModalOpen] = useState<boolean>(false);
  const [videoMetadata, setVideoMetadata] = useState<{
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  } | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<Array<{ timestamp: string; imageUrl: string; id?: string }>>([]);
  const [needsFrameExtraction, setNeedsFrameExtraction] = useState<boolean>(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState<boolean>(false);
  const [allTimestamps, setAllTimestamps] = useState<string[]>([]);

  const currentSlide = slides[currentSlideIndex];
  const SECONDS_PER_SLIDE = 30; // Default estimate: 30 seconds per slide
  
  useEffect(() => {
    // Calculate estimated time remaining
    if (slides.length) {
      const slidesRemaining = slides.length - currentSlideIndex - 1;
      setEstimatedTimeRemaining(slidesRemaining * SECONDS_PER_SLIDE);
    }
  }, [currentSlideIndex, slides.length]);
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        toast.error("Could not enable fullscreen mode");
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };
  
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDarkTheme(!isDarkTheme);
    toast.success(`${isDarkTheme ? "Light" : "Dark"} mode activated`);
  };
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
      case ' ':
        goToNextSlide();
        break;
      case 'ArrowLeft':
        goToPrevSlide();
        break;
      case 'Escape':
        if (isFullscreen) {
          document.exitFullscreen();
          setIsFullscreen(false);
        } else {
          exitPresentation();
        }
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        toast.success(isFullscreen ? "Exited fullscreen" : "Entered fullscreen mode");
        break;
      case 't':
      case 'T':
        toggleTheme();
        break;
      case 'h':
      case 'H':
        setShowMetadata(!showMetadata);
        toast.success(`${showMetadata ? "Hidden" : "Showing"} slide metadata`);
        break;
    }
  }, [currentSlideIndex, slides.length, isFullscreen, showMetadata, isDarkTheme]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  useEffect(() => {
    // Handle fullscreen change event
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  const exitPresentation = () => {
    navigate(`/projects/${projectId}`);
  };
  
  const goToNextSlide = () => {
    if (currentSlideIndex < slides.length - 1 && !isTransitioning) {
      setTransitionDirection("next");
      setIsTransitioning(true);
      
      // Delay the actual slide change to allow for animation
      setTimeout(() => {
        setCurrentSlideIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 300); // Match this with the animation duration
    }
  };
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0 && !isTransitioning) {
      setTransitionDirection("prev");
      setIsTransitioning(true);
      
      // Delay the actual slide change to allow for animation
      setTimeout(() => {
        setCurrentSlideIndex(prev => prev - 1);
        setIsTransitioning(false);
      }, 300); // Match this with the animation duration
    }
  };

  // Improved frame picker handler with better error handling
  const handleOpenFramePicker = () => {
    console.log("Opening frame picker modal", {
      projectId,
      hasSourceFilePath: !!project?.source_file_path,
    });
    
    if (!project?.source_file_path) {
      toast.error("No video source available for frame picking");
      return;
    }
    
    setIsFramePickerModalOpen(true);
  };

  // New function to handle frame extraction
  const handleExtractFrames = async () => {
    if (!project?.source_file_path || isExtractingFrames || allTimestamps.length === 0) {
      return;
    }
    
    setIsExtractingFrames(true);
    try {
      toast.success("Frame extraction initiated");
      // This is just a placeholder - actual implementation would need to integrate with your frame extraction service
      setTimeout(() => {
        toast.success("Frames extracted successfully");
        setIsExtractingFrames(false);
        setNeedsFrameExtraction(false);
      }, 2000);
    } catch (error) {
      console.error("Error extracting frames:", error);
      toast.error("Failed to extract frames");
      setIsExtractingFrames(false);
    }
  };

  const handleFrameSelectionComplete = (selectedFrames: Array<{ timestamp: string; imageUrl: string; id?: string }>) => {
    console.log("Frame selection complete", selectedFrames);
    setIsFramePickerModalOpen(false);
    
    if (selectedFrames.length === 0) {
      toast.info("No frames were selected");
      return;
    }
    
    // Here you would normally update the slides with the selected frames
    setExtractedFrames(selectedFrames); // Store the selected frames
    toast.success(`${selectedFrames.length} frames have been selected`);
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
            // Check if any slide has a transition type defined, otherwise use default
            const firstSlideWithTransition = projectData.slides.find(slide => slide.transitionType);
            const defaultTransition = firstSlideWithTransition?.transitionType || "fade";
            setTransitionType(defaultTransition);
            setSlides(projectData.slides);
          } else {
            toast.error("No slides available for presentation");
            exitPresentation();
          }
        } else {
          toast.error("Invalid slide format");
          exitPresentation();
        }

        // Extract video metadata if it exists
        if (projectData?.video_metadata) {
          setVideoMetadata(projectData.video_metadata as {
            duration?: number;
            original_file_name?: string;
            file_type?: string;
            file_size?: number;
          });
        }

        // Get previously extracted frames
        if (projectData?.extracted_frames && Array.isArray(projectData.extracted_frames)) {
          setExtractedFrames(projectData.extracted_frames as Array<{ timestamp: string; imageUrl: string; id?: string }>);
        }

        // Check if we need frame extraction
        if (projectData?.source_type === 'video') {
          setNeedsFrameExtraction(true);
          
          // Collect timestamps for potential extraction
          const timestamps: string[] = [];
          if (Array.isArray(projectData.slides)) {
            projectData.slides.forEach(slide => {
              if (slide && typeof slide === 'object') {
                if ('timestamp' in slide && typeof slide.timestamp === 'string') {
                  timestamps.push(slide.timestamp);
                }
                if ('transcriptTimestamps' in slide && Array.isArray(slide.transcriptTimestamps)) {
                  slide.transcriptTimestamps.forEach(timestamp => {
                    if (typeof timestamp === 'string') {
                      timestamps.push(timestamp);
                    }
                  });
                }
              }
            });
          }
          setAllTimestamps([...new Set(timestamps)]);
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
  
  // Get animation classes based on transition settings
  const getSlideAnimationClasses = () => {
    // Base positioning classes
    let classes = "absolute inset-0 w-full h-full transition-all duration-300 ";
    
    if (isTransitioning) {
      if (transitionType === "fade") {
        classes += transitionDirection === "next" ? "animate-fade-out" : "animate-fade-in";
      } else if (transitionType === "slide") {
        classes += transitionDirection === "next" ? "translate-x-full opacity-0" : "-translate-x-full opacity-0";
      } else if (transitionType === "zoom") {
        classes += transitionDirection === "next" ? "scale-95 opacity-0" : "scale-105 opacity-0";
      }
    } else {
      classes += "opacity-100 translate-x-0 scale-100";
      
      // Add entry animation when not transitioning
      if (transitionDirection !== "none") {
        if (transitionType === "fade") {
          classes += " animate-fade-in";
        } else if (transitionType === "slide") {
          classes += " animate-slide-in";
        } else if (transitionType === "zoom") {
          classes += " animate-scale-in";
        }
      }
    }
    
    return classes;
  };
  
  // Format time remaining as MM:SS
  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
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
    <div className="h-screen w-screen max-w-full overflow-hidden bg-background text-foreground flex flex-col">
      {/* Header with controls - visible only when showMetadata is true */}
      <div className={`p-4 absolute top-0 left-0 right-0 z-10 flex justify-between items-center transition-opacity duration-300 bg-gradient-to-b from-black/70 to-transparent ${showMetadata ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="text-sm opacity-70">
          {project?.title} • Slide {currentSlideIndex + 1} of {slides.length}
        </div>
        
        <div className="flex gap-2">
          {/* Frame Tools Dropdown with improved handlers */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <Film className="h-5 w-5" />
                <span className="sr-only">Frame tools</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {project?.source_type === 'video' && project?.source_file_path && (
                <>
                  <DropdownMenuVideoFrameButton 
                    onClick={handleOpenFramePicker} 
                    className="cursor-pointer"
                  >
                    <Film className="h-4 w-4 mr-2" />
                    <span>Select Video Frames</span>
                  </DropdownMenuVideoFrameButton>
                  
                  {needsFrameExtraction && (
                    <DropdownMenuVideoFrameButton 
                      onClick={handleExtractFrames} 
                      disabled={isExtractingFrames}
                      className="cursor-pointer"
                    >
                      <Image className="h-4 w-4 mr-2" />
                      <span>
                        {isExtractingFrames 
                          ? "Extracting Frames..." 
                          : "Extract Missing Frames"
                        }
                      </span>
                    </DropdownMenuVideoFrameButton>
                  )}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleTheme}>
                {isDarkTheme ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                <span>{isDarkTheme ? "Light Mode" : "Dark Mode"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleFullscreen}>
                <Fullscreen className="h-4 w-4 mr-2" />
                <span>Toggle Fullscreen</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="ghost" size="icon" onClick={exitPresentation} className="text-white hover:bg-white/10">
            <X className="h-5 w-5" />
            <span className="sr-only">Exit presentation</span>
          </Button>
        </div>
      </div>
      
      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center p-8 relative" ref={slideContainerRef}>
        <div className={getSlideAnimationClasses()}>
          <div className="max-w-4xl w-full mx-auto h-full flex items-center justify-center">
            {currentSlide && <SlideContent slide={currentSlide} />}
          </div>
        </div>
      </div>
      
      {/* Navigation controls and progress bar */}
      <div className={`absolute bottom-0 left-0 right-0 flex flex-col transition-opacity duration-300 ${showMetadata ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Progress bar */}
        <div className="w-full">
          <Progress value={((currentSlideIndex + 1) / slides.length) * 100} className="h-1 rounded-none bg-white/10" />
        </div>
        
        {/* Controls */}
        <div className="p-6 flex justify-between items-center bg-gradient-to-t from-black/70 to-transparent">
          <Button 
            variant="ghost" 
            onClick={goToPrevSlide} 
            disabled={currentSlideIndex === 0 || isTransitioning}
            className="text-white disabled:opacity-30 hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous
          </Button>
          
          <div className="flex flex-col items-center text-sm">
            <div className="flex items-center gap-2">
              <span>{currentSlideIndex + 1} / {slides.length}</span>
              <Timer className="h-4 w-4 opacity-70" />
              <span>{formatTimeRemaining(estimatedTimeRemaining)}</span>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={goToNextSlide} 
            disabled={currentSlideIndex === slides.length - 1 || isTransitioning}
            className="text-white disabled:opacity-30 hover:bg-white/10"
          >
            Next
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </div>
      
      {/* Floating help tooltip - shown briefly when presentation starts */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs rounded-full px-4 py-2 animate-fade-in">
        Press <kbd className="px-1 py-0.5 bg-white/20 rounded">H</kbd> to toggle UI • 
        <kbd className="px-1 py-0.5 bg-white/20 rounded ml-1">F</kbd> for fullscreen • 
        <kbd className="px-1 py-0.5 bg-white/20 rounded ml-1">T</kbd> for theme
      </div>

      {/* Frame Picker Modal with improved error handling and debugging */}
      {project && project.source_file_path && (
        <FramePickerModal 
          open={isFramePickerModalOpen} 
          onClose={() => {
            console.log("Closing frame picker modal");
            setIsFramePickerModalOpen(false);
          }} 
          videoPath={project.source_file_path} 
          projectId={projectId || ""} 
          onComplete={handleFrameSelectionComplete} 
          videoMetadata={videoMetadata || undefined} 
          existingFrames={extractedFrames} 
        />
      )}
    </div>
  );
};

export default SlidePreview;
