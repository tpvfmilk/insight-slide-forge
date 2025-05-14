
import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProjectById } from "@/services/projectService";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slide } from "@/components/slides/editor/SlideEditorTypes";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";

const PresentationPage = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  
  // Get current slide
  const currentSlide = slides[currentSlideIndex];
  
  // Handler for keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      goToNextSlide();
    } else if (e.key === "ArrowLeft") {
      goToPrevSlide();
    }
  }, [currentSlideIndex, slides.length]);
  
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
          // Type assertion to convert the JSON data to Slide[] type
          setSlides(project.slides as Slide[]);
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
    
    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [projectId, handleKeyDown]);
  
  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {/* Header */}
      <PresentationHeader 
        projectTitle={projectTitle} 
        projectId={projectId || ""} 
        isLoading={isLoading}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {isLoading ? (
          <PresentationSkeleton />
        ) : slides.length > 0 ? (
          <PresentationSlide slide={currentSlide} />
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
        />
      )}
    </div>
  );
};

// Presentation Header Component
const PresentationHeader: React.FC<{
  projectTitle: string;
  projectId: string;
  isLoading: boolean;
}> = ({ projectTitle, projectId, isLoading }) => {
  return (
    <div className="w-full px-4 py-3 bg-black/90 border-b border-white/10 flex items-center justify-between">
      <Button 
        variant="ghost" 
        size="sm" 
        asChild 
        className="text-white hover:bg-white/10"
      >
        <Link to={`/projects/${projectId}`}>
          <X className="h-4 w-4 mr-1" />
          Exit Presentation
        </Link>
      </Button>
      
      {!isLoading && projectTitle && (
        <div className="text-sm font-medium text-white/80 truncate max-w-md">
          {projectTitle}
        </div>
      )}
    </div>
  );
};

// Presentation Slide Component
const PresentationSlide: React.FC<{
  slide: Slide;
}> = ({ slide }) => {
  const hasImages = Boolean(
    (slide.imageUrl && slide.imageUrl.length > 0) || 
    (slide.imageUrls && slide.imageUrls.length > 0)
  );
  
  // Collect all images from both imageUrl and imageUrls
  const allImages: string[] = [];
  if (slide.imageUrl) allImages.push(slide.imageUrl);
  if (slide.imageUrls) allImages.push(...slide.imageUrls);
  
  return (
    <div className="w-full max-w-5xl mx-auto">
      {hasImages ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left side: Image grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {allImages.map((imageUrl, index) => (
                <div key={index} className="rounded-md overflow-hidden border border-white/10">
                  <AspectRatio ratio={16/9}>
                    <img 
                      src={imageUrl} 
                      alt={`Slide image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </AspectRatio>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right side: Slide content */}
          <div className="flex flex-col p-4 space-y-4">
            <h2 className="text-2xl font-semibold">{slide.title}</h2>
            <div className="mt-2 whitespace-pre-wrap">{slide.content}</div>
          </div>
        </div>
      ) : (
        // No images - center the content
        <div className="text-center p-8 max-w-2xl mx-auto">
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
}> = ({ currentSlideIndex, totalSlides, goToPrevSlide, goToNextSlide }) => {
  return (
    <div className="w-full border-t border-white/10 bg-black/80 py-3 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
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
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
