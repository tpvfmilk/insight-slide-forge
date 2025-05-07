
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Project, fetchProjectById } from "@/services/projectService";
import { toast } from "sonner";
import { SlideEditor } from "@/components/slides/SlideEditor";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { generateSlidesForProject, hasValidSlides } from "@/services/slideGenerationService";

const ProjectPage = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  const loadProject = async () => {
    if (!projectId) return;
    
    try {
      setIsLoading(true);
      const projectData = await fetchProjectById(projectId);
      
      if (!projectData) {
        toast.error("Project not found");
        navigate("/projects");
        return;
      }
      
      setProject(projectData);
      
      // For new projects, automatically trigger slide generation if no slides exist
      const isNewlyCreated = Date.now() - new Date(projectData.created_at).getTime() < 60000; // Within a minute
      const shouldAutoGenerate = isNewlyCreated && !hasValidSlides(projectData);
      
      if (shouldAutoGenerate) {
        handleGenerateSlides();
      }
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadProject();
  }, [projectId]);
  
  const handleGenerateSlides = async () => {
    if (!projectId || isGenerating) return;
    
    setIsGenerating(true);
    
    try {
      const result = await generateSlidesForProject(projectId);
      
      if (result.success && result.slides) {
        // Update the project in state with the new slides
        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            slides: result.slides
          };
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <InsightLayout>
      <div className="h-full flex flex-col">
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="outline" size="sm" asChild className="mr-4">
              <a onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </a>
            </Button>
            
            <div>
              <h1 className="text-xl font-semibold truncate">
                {isLoading ? "Loading..." : project?.title || "Untitled Project"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {project?.source_type === 'video' ? 'From video upload' : 
                 project?.source_type === 'url' ? 'From URL' : 
                 project?.source_type === 'transcript' ? 'From transcript' : 'Unknown source'}
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGenerateSlides} 
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                Generate Slides
              </>
            )}
          </Button>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
                <p className="text-sm text-muted-foreground">Loading project...</p>
              </div>
            </div>
          ) : (
            <SlideEditor />
          )}
        </div>
      </div>
    </InsightLayout>
  );
};

export default ProjectPage;
