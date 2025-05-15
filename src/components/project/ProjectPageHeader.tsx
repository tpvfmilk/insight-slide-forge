
import { Button } from "@/components/ui/button";
import { Project } from "@/services/projectService";
import { formatFileSize } from "@/utils/formatUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/utils/formatUtils";
import { Dices, Film } from "lucide-react";

export interface ProjectPageHeaderProps {
  project: Project | null;
  isLoading: boolean;
  videoFileName?: string;
  totalVideoDuration?: number;
  hasChunkedVideo?: boolean;
}

export function ProjectPageHeader({ 
  project, 
  isLoading, 
  videoFileName,
  totalVideoDuration,
  hasChunkedVideo
}: ProjectPageHeaderProps) {
  if (isLoading) {
    return (
      <div className="flex-1">
        <Skeleton className="h-6 w-48 mb-1" />
        <Skeleton className="h-4 w-36" />
      </div>
    );
  }

  const videoMetadata = project?.video_metadata as any;
  const fileSize = videoMetadata?.file_size ? formatFileSize(videoMetadata.file_size) : null;
  const formattedDuration = totalVideoDuration 
    ? formatDuration(totalVideoDuration) 
    : (videoMetadata?.duration ? formatDuration(videoMetadata.duration) : null);

  return (
    <div className="flex-1">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        {project?.title || "Untitled Project"}
        {hasChunkedVideo && (
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium inline-flex items-center">
            <Film className="h-3 w-3 mr-1" />
            Chunked Video
          </span>
        )}
        {project?.source_type === "transcript-only" && (
          <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium inline-flex items-center">
            <Dices className="h-3 w-3 mr-1" />
            AI Generated
          </span>
        )}
      </h1>
      
      <div className="text-sm text-muted-foreground">
        {project?.source_type === 'video' && (
          <>
            {videoFileName && <span>{videoFileName}</span>}
            {fileSize && <span> · {fileSize}</span>}
            {formattedDuration && <span> · {formattedDuration}</span>}
          </>
        )}
        {project?.source_type === 'transcript-only' && (
          <span>Transcript-only project</span>
        )}
        {!project?.source_type && (
          <span>Unknown source type</span>
        )}
      </div>
    </div>
  );
}
