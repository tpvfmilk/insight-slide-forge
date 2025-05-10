
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit2, Video, Clock } from "lucide-react";
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
  totalVideoDuration?: number;
}

export const ProjectPageHeader = ({ 
  project, 
  isLoading, 
  videoFileName, 
  onVideoAdded,
  totalVideoDuration = 0
}: ProjectPageHeaderProps) => {
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
  
  // Format duration in a readable way
  const formatDuration = (seconds: number) => {
    if (!seconds) return null;
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ${Math.round(seconds % 60)}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
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
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getVideoCount() || (project?.source_type === 'video' ? 1 : 0)} video{(getVideoCount() || 1) !== 1 ? 's' : ''}
                </Badge>
                {totalVideoDuration > 0 && (
                  <span className="flex items-center text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    {formatDuration(totalVideoDuration)}
                  </span>
                )}
              </div>
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
