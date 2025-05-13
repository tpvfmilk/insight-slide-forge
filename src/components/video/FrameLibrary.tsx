
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2 } from "lucide-react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

interface FrameLibraryProps {
  frames: ExtractedFrame[];
  selectedFrames: { [key: string]: boolean };
  onSelectFrame: (frame: ExtractedFrame) => void;
  onRemoveFrame: (frameId: string) => void;
  isCompact?: boolean;
}

export const FrameLibrary: React.FC<FrameLibraryProps> = ({
  frames,
  selectedFrames,
  onSelectFrame,
  onRemoveFrame,
  isCompact = false
}) => {
  // Get count of selected frames
  const selectedFramesCount = Object.keys(selectedFrames).length;
  
  return (
    <div className="space-y-2 flex-1 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Frame Library</h3>
        <div className="text-sm text-muted-foreground">
          {selectedFramesCount} frame{selectedFramesCount !== 1 ? 's' : ''} selected
        </div>
      </div>
      
      <div className={`${isCompact ? 'h-[200px]' : 'h-[300px]'} bg-muted/30 rounded-md overflow-hidden`}>
        <ScrollArea className="h-full">
          {frames.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
              {frames.map((frame) => (
                <div 
                  key={frame.id} 
                  className={`relative aspect-video cursor-pointer rounded-md overflow-hidden border-2 ${
                    selectedFrames[frame.id!] ? 'border-primary' : 'border-transparent'
                  }`}
                  onClick={() => onSelectFrame(frame)}
                >
                  <img
                    src={frame.imageUrl}
                    alt={`Frame at ${frame.timestamp}`}
                    className="h-full w-full object-cover"
                  />
                  <Badge className="absolute top-1 left-1 text-xs">{frame.timestamp}</Badge>
                  {selectedFrames[frame.id!] && (
                    <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-6 w-6 absolute bottom-1 right-1 opacity-0 hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFrame(frame.id as string);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p>No frames in library</p>
                <p className="text-sm mt-2">Capture frames from the video to add them to the library</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
