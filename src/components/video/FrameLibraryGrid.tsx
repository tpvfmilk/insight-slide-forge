
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2 } from "lucide-react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface FrameLibraryGridProps {
  libraryFrames: ExtractedFrame[];
  selectedFrames: {[key: string]: boolean};
  toggleFrameSelection: (frame: ExtractedFrame) => void;
  removeFrame: (frameId: string) => void;
}

export const FrameLibraryGrid: React.FC<FrameLibraryGridProps> = ({
  libraryFrames,
  selectedFrames,
  toggleFrameSelection,
  removeFrame
}) => {
  if (libraryFrames.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>No frames in library</p>
          <p className="text-sm mt-2">Capture frames from the video to add them to the library</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <ScrollArea className="h-full">
        <div className="grid grid-cols-3 gap-3 p-2 pb-8">
          {libraryFrames.map((frame) => (
            <div 
              key={frame.id} 
              className={`relative cursor-pointer rounded-md overflow-hidden border-2 ${
                selectedFrames[frame.id!] ? 'border-primary' : 'border-transparent'
              }`}
              onClick={() => toggleFrameSelection(frame)}
            >
              <AspectRatio ratio={16/9}>
                <img
                  src={frame.imageUrl}
                  alt={`Frame at ${frame.timestamp}`}
                  className="h-full w-full object-cover"
                />
              </AspectRatio>
              <Badge className="absolute top-1 left-1 text-xs">{frame.timestamp}</Badge>
              {selectedFrames[frame.id!] && (
                <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFrame(frame.id as string);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
