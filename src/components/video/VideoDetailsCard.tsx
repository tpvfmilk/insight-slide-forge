
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/utils/formatUtils";

interface VideoDetailsCardProps {
  videoMetadata?: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  };
}

export function VideoDetailsCard({ videoMetadata }: VideoDetailsCardProps) {
  if (!videoMetadata) return null;

  // Format file size to human-readable format
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-4 px-4 pb-3">
        <div className="space-y-2 text-sm">
          {videoMetadata.original_file_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Filename:</span>
              <span className="font-medium truncate max-w-[200px]">{videoMetadata.original_file_name}</span>
            </div>
          )}
          {videoMetadata.duration !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{formatDuration(videoMetadata.duration)}</span>
            </div>
          )}
          {videoMetadata.file_type && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium">{videoMetadata.file_type}</span>
            </div>
          )}
          {videoMetadata.file_size !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size:</span>
              <span className="font-medium">{formatFileSize(videoMetadata.file_size)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
