
import { HardDrive } from "lucide-react";
import { formatFileSize } from "@/utils/formatUtils";
import { useEffect, useState } from "react";
import { getProjectTotalSize } from "@/services/storageService";

interface FileSizeBadgeProps {
  fileSize?: number;
  projectId?: string;
}

export function FileSizeBadge({ fileSize, projectId }: FileSizeBadgeProps) {
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
  
  let displayText = isLoading ? "Calculating..." : "Unknown size";
  let color = "text-muted-foreground";
  
  if (totalSize !== undefined && !isLoading) {
    displayText = formatFileSize(totalSize);
    color = "text-primary";
  }
  
  return (
    <div className="flex items-center">
      <HardDrive className="h-4 w-4 mr-1 text-muted-foreground" />
      <span className={color}>{displayText}</span>
    </div>
  );
}
