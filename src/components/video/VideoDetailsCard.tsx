
import { formatDuration, formatFileSize } from "@/utils/formatUtils";

interface VideoDetailsProps {
  fileName?: string;
  duration?: number;
  fileType?: string;
  fileSize?: number;
}

export const VideoDetailsCard = ({ 
  fileName, 
  duration, 
  fileType,
  fileSize 
}: VideoDetailsProps) => {
  if (!fileName && !duration && !fileType && !fileSize) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-medium">Video Details</h3>
      
      <div className="space-y-2">
        {fileName && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">File name:</span>
            <span className="font-medium truncate max-w-[250px]" title={fileName}>{fileName}</span>
          </div>
        )}
        
        {duration && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{formatDuration(duration)}</span>
          </div>
        )}
        
        {fileType && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Format:</span>
            <span className="font-medium">{fileType.split('/')[1]?.toUpperCase() || fileType}</span>
          </div>
        )}
        
        {fileSize && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">File size:</span>
            <span className="font-medium">{formatFileSize(fileSize)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
