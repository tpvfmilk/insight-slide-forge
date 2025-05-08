
import { HardDrive } from "lucide-react";
import { formatStorageSize } from "@/services/usageService";

interface FileSizeBadgeProps {
  fileSize: number | undefined;
}

export function FileSizeBadge({ fileSize }: FileSizeBadgeProps) {
  let displayText = "Unknown size";
  let color = "text-muted-foreground";
  
  if (fileSize !== undefined) {
    displayText = formatStorageSize(fileSize);
    color = "text-primary";
  }
  
  return (
    <div className="flex items-center">
      <HardDrive className="h-4 w-4 mr-1 text-muted-foreground" />
      <span className={color}>{displayText}</span>
    </div>
  );
}
