
import { formatFileSize } from "@/utils/formatUtils";
import { useEffect, useState } from "react";
import { getProjectTotalSize } from "@/services/storageService";
import { Badge } from "@/components/ui/badge";

interface FileSizeBadgeProps {
  fileSize?: number;
  projectId?: string;
}

export function FileSizeBadge({
  fileSize,
  projectId
}: FileSizeBadgeProps) {
  const [totalSize, setTotalSize] = useState<number | undefined>(fileSize);
  const [isLoading, setIsLoading] = useState<boolean>(!!projectId);
  
  useEffect(() => {
    async function loadTotalProjectSize() {
      if (!projectId) return;
      try {
        setIsLoading(true);
        const size = await getProjectTotalSize(projectId);

        // If we have both the file size and project size, use the larger one
        // This covers cases where the project size calculation might be incomplete
        if (fileSize && fileSize > size) {
          setTotalSize(fileSize);
        } else {
          setTotalSize(size);
        }
      } catch (error) {
        console.error("Error loading project size:", error);
        setTotalSize(fileSize); // Fallback to file size on error
      } finally {
        setIsLoading(false);
      }
    }
    loadTotalProjectSize();
  }, [projectId, fileSize]);
  
  if (isLoading) {
    return <Badge variant="outline" className="font-normal">Calculating...</Badge>;
  }
  
  if (totalSize === undefined) {
    return <Badge variant="outline" className="font-normal">Unknown</Badge>;
  }
  
  return <Badge variant="secondary" className="font-normal">{formatFileSize(totalSize)}</Badge>;
}
