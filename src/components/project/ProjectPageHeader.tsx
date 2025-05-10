
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit2, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { Project } from "@/services/projectService";
import { updateProject } from "@/services/uploadService";
import { toast } from "sonner";
import { VideoManagement } from "@/components/project/VideoManagement";

interface ProjectPageHeaderProps {
  project: Project | null;
  isLoading: boolean;
  videoFileName: string;
  onVideoAdded?: () => void;
}

export const ProjectPageHeader = ({ project, isLoading, videoFileName, onVideoAdded }: ProjectPageHeaderProps) => {
  const navigate = useNavigate();
  const [isEditTitleDialogOpen, setIsEditTitleDialogOpen] = useState<boolean>(false);
  const [isVideoManagementOpen, setIsVideoManagementOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>(project?.title || "Untitled Project");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveTitle = async () => {
    if (!project?.id) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(project.id, {
        title: title
      });
      
      toast.success("Project title saved");
      setIsEditTitleDialogOpen(false);
    } catch (error) {
      console.error("Error saving title:", error);
      toast.error("Failed to save project title");
    } finally {
      setIsSaving(false);
    }
  };

  const getVideoCount = () => {
    if (!project?.videos) return 0;
    return project.videos.length;
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <Button variant="outline" size="sm" asChild className="mr-4">
          <a onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </a>
        </Button>
        
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold truncate">
              {isLoading ? "Loading..." : project?.title || "Untitled Project"}
            </h1>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsEditTitleDialogOpen(true)}
              className="h-6 w-6"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {project?.source_type === 'video' ? 'From video upload' : 
               project?.source_type === 'url' ? 'From URL' : 
               project?.source_type === 'transcript-only' ? 'Extracted transcript' :
               project?.source_type === 'transcript' ? 'From transcript' : 'Unknown source'}
            </p>
            {/* Video count badge */}
            {(project?.source_type === 'video' || getVideoCount() > 0) && (
              <Badge variant="outline" className="text-xs">
                {getVideoCount()} video{getVideoCount() !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsVideoManagementOpen(true)}
        >
          <Video className="h-4 w-4 mr-2" />
          Manage Videos
        </Button>
      </div>

      {/* Edit Title Dialog */}
      <Dialog open={isEditTitleDialogOpen} onOpenChange={setIsEditTitleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project Title</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title"
              className="w-full"
            />
            
            <div className="flex justify-end mt-4 space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsEditTitleDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveTitle}
                disabled={isSaving || !title.trim()}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : "Save Title"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Management Dialog */}
      <VideoManagement 
        project={project}
        isOpen={isVideoManagementOpen}
        onClose={() => setIsVideoManagementOpen(false)}
        onVideoAdded={() => {
          if (onVideoAdded) onVideoAdded();
        }}
      />
    </div>
  );
};
