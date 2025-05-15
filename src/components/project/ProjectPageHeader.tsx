
import { useState } from "react";
import { Project } from "@/services/projectService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, FileText, Pencil, VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectPageHeaderProps {
  project: Project | null;
  isLoading: boolean;
  videoFileName: string | undefined;
  totalVideoDuration?: number;
  hasChunkedVideo?: boolean; // Added this prop
}

export const ProjectPageHeader = ({
  project,
  isLoading,
  videoFileName,
  totalVideoDuration,
  hasChunkedVideo
}: ProjectPageHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(project?.title || "");
  
  const handleSaveTitle = async () => {
    if (!project) return;
    
    try {
      const { error } = await supabase
        .from("projects")
        .update({ title })
        .eq("id", project.id);
      
      if (error) throw error;
      
      toast.success("Project title updated");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating project title:", error);
      toast.error("Failed to update project title");
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    
    return `${minutes}m`;
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="max-w-[300px]"
            placeholder="Project title"
            autoFocus
          />
          <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSaveTitle}>
            Save
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{project?.title || "Untitled Project"}</h1>
          <Button variant="ghost" size="icon" onClick={() => {
            setTitle(project?.title || "");
            setIsEditing(true);
          }} className="h-7 w-7">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      
      <div className="flex items-center text-sm text-muted-foreground gap-4">
        {project?.source_type === 'video' && videoFileName && (
          <div className="flex items-center gap-1">
            <VideoIcon className="h-3.5 w-3.5" />
            <span>{videoFileName}</span>
            {hasChunkedVideo && <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full ml-1">Chunked</span>}
          </div>
        )}
        
        {project?.source_type === 'transcript' && (
          <div className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            <span>Text Transcript</span>
          </div>
        )}
        
        {totalVideoDuration && totalVideoDuration > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDuration(totalVideoDuration)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
