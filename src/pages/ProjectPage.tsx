
import { InsightLayout } from "@/components/layout/InsightLayout";
import { SlideEditor } from "@/components/slides/SlideEditor";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { Link, useParams } from "react-router-dom";

const ProjectPage = () => {
  const { id } = useParams<{ id: string }>();
  
  // In a real app, we would fetch project data based on the ID
  // For now, we'll use a placeholder title
  const projectTitle = "Introduction to Quantum Computing";
  
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
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h1 className="font-medium truncate">{projectTitle}</h1>
            </div>
          </div>
        </div>
        
        {/* Slide Editor takes the remaining height */}
        <div className="flex-1">
          <SlideEditor />
        </div>
      </div>
    </InsightLayout>
  );
};

export default ProjectPage;
