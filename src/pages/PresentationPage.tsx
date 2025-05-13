
import { useEffect, useState } from "react";
import { SlidePreview } from "@/components/slides/SlidePreview";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchProjectById } from "@/services/projectService";
import { toast } from "sonner";

const PresentationPage = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [projectTitle, setProjectTitle] = useState<string>("");
  
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
  
  // Show a mini control bar at the very top for easy navigation back to editor
  return (
    <div className="h-screen flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-50 bg-black/70 text-white p-2 flex items-center justify-between">
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
            {projectTitle}
          </div>
        )}
      </div>
      
      <div className="flex-1">
        <SlidePreview />
      </div>
    </div>
  );
};

export default PresentationPage;
