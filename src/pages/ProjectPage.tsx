
import { useState, useEffect } from "react";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { SlideEditor } from "@/components/slides/SlideEditor";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchProjectById, Project } from "@/services/projectService";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const ProjectPage = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const data = await fetchProjectById(id);
        setProject(data);
      } catch (error) {
        console.error(`Failed to load project with ID ${id}:`, error);
        toast.error("Failed to load project");
      } finally {
        setLoading(false);
      }
    };
    
    loadProject();
  }, [id]);
  
  return (
    <InsightLayout>
      <div className="flex flex-col h-full">
        <div className="border-b">
          <div className="container flex h-16 items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link to="/projects">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to projects</span>
              </Link>
            </Button>
            
            {loading ? (
              <Skeleton className="h-4 w-[200px]" />
            ) : (
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h1 className="font-medium truncate">
                  {project?.title || "Project not found"}
                </h1>
              </div>
            )}
          </div>
        </div>
        
        {/* Slide Editor takes the remaining height */}
        <div className="flex-1">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
                <p className="text-sm text-muted-foreground">Loading project...</p>
              </div>
            </div>
          ) : project ? (
            <SlideEditor />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-xl font-medium mb-2">Project not found</p>
                <p className="text-muted-foreground mb-6">The project you're looking for doesn't exist or has been removed.</p>
                <Button asChild>
                  <Link to="/projects">Back to Projects</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </InsightLayout>
  );
};

export default ProjectPage;
