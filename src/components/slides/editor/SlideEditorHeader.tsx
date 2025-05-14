
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Presentation } from "lucide-react";
import { Link } from "react-router-dom";
import { useSlideEditor } from "./SlideEditorContext";
import { SlideExportDialog } from "./SlideExportDialog";

export const SlideEditorHeader: React.FC = () => {
  const { 
    projectId,
    slides
  } = useSlideEditor();

  return (
    <div className="flex justify-between items-center p-4 border-b w-full">
      <div className="flex-1">
        {/* Slide count information was here, now moved to navigation bar */}
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          asChild 
          disabled={slides.length <= 1 || slides[0].id === "slide-placeholder"}
        >
          <Link to={`/projects/${projectId}/present`}>
            <Presentation className="h-4 w-4 mr-1" />
            Present
          </Link>
        </Button>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <svg xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-1" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export
            </Button>
          </DialogTrigger>
          <SlideExportDialog />
        </Dialog>
      </div>
    </div>
  );
};
