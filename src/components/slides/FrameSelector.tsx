
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { Check, CheckCircle2, Image as ImageIcon, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface FrameSelectorProps {
  open: boolean;
  onClose: () => void;
  availableFrames: ExtractedFrame[];
  selectedFrames: ExtractedFrame[];
  onSelect: (frames: ExtractedFrame[]) => void;
}

export const FrameSelector = ({
  open,
  onClose,
  availableFrames,
  selectedFrames,
  onSelect,
}: FrameSelectorProps) => {
  const [selection, setSelection] = useState<ExtractedFrame[]>(selectedFrames);
  
  // Group frames by timestamp
  const framesGroupedByTime = availableFrames.reduce((acc, frame) => {
    // Extract minutes from timestamp (e.g. "5:20" -> "5")
    const minute = frame.timestamp.split(':')[0];
    const group = minute ? `${minute} min` : "0 min";
    
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(frame);
    return acc;
  }, {} as Record<string, ExtractedFrame[]>);
  
  // Sort the time groups
  const sortedTimeGroups = Object.keys(framesGroupedByTime).sort((a, b) => {
    const minA = parseInt(a);
    const minB = parseInt(b);
    return minA - minB;
  });
  
  const isSelected = (frame: ExtractedFrame) => {
    return selection.some(f => f.timestamp === frame.timestamp);
  };
  
  const toggleFrameSelection = (frame: ExtractedFrame) => {
    if (isSelected(frame)) {
      setSelection(selection.filter(f => f.timestamp !== frame.timestamp));
    } else {
      setSelection([...selection, frame]);
    }
  };
  
  const handleApplySelection = () => {
    onSelect(selection);
    onClose();
  };
  
  const clearSelection = () => {
    setSelection([]);
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select Frame{selection.length !== 1 ? 's' : ''} for Slide</DialogTitle>
        </DialogHeader>
        
        {availableFrames.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mb-2" />
            <p>No extracted frames available for this project</p>
            <p className="text-sm mt-1">Try extracting frames automatically or using the manual frame picker</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm">
                  {selection.length} frame{selection.length !== 1 ? 's' : ''} selected
                </span>
                {selection.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearSelection}
                    className="ml-2 h-7 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                {availableFrames.length} total frames available
              </div>
            </div>
            
            <Tabs defaultValue={sortedTimeGroups[0] || "all"}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Frames</TabsTrigger>
                {sortedTimeGroups.slice(0, 5).map(group => (
                  <TabsTrigger key={group} value={group}>{group}</TabsTrigger>
                ))}
                {sortedTimeGroups.length > 5 && (
                  <TabsTrigger value="more">More...</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="all">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {availableFrames.map((frame) => (
                    <FrameItem 
                      key={frame.timestamp}
                      frame={frame}
                      isSelected={isSelected(frame)}
                      onToggleSelect={() => toggleFrameSelection(frame)}
                    />
                  ))}
                </div>
              </TabsContent>
              
              {sortedTimeGroups.map(group => (
                <TabsContent key={group} value={group}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {framesGroupedByTime[group].map((frame) => (
                      <FrameItem 
                        key={frame.timestamp}
                        frame={frame}
                        isSelected={isSelected(frame)}
                        onToggleSelect={() => toggleFrameSelection(frame)}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
              
              {sortedTimeGroups.length > 5 && (
                <TabsContent value="more">
                  <div className="grid grid-cols-2 gap-4">
                    {sortedTimeGroups.slice(5).map(group => (
                      <div key={group} className="border rounded-lg p-4">
                        <h3 className="font-medium mb-2">{group}</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {framesGroupedByTime[group].slice(0, 4).map((frame) => (
                            <FrameItem 
                              key={frame.timestamp}
                              frame={frame}
                              isSelected={isSelected(frame)}
                              onToggleSelect={() => toggleFrameSelection(frame)}
                              compact
                            />
                          ))}
                          {framesGroupedByTime[group].length > 4 && (
                            <div className="flex items-center justify-center border rounded h-16 text-sm text-muted-foreground">
                              +{framesGroupedByTime[group].length - 4} more
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              )}
            </Tabs>
            
            <Separator />
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                disabled={selection.length === 0} 
                onClick={handleApplySelection}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Apply to Slide
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface FrameItemProps {
  frame: ExtractedFrame;
  isSelected: boolean;
  onToggleSelect: () => void;
  compact?: boolean;
}

const FrameItem = ({ frame, isSelected, onToggleSelect, compact }: FrameItemProps) => {
  return (
    <div 
      className={`relative border rounded-md overflow-hidden ${
        isSelected ? 'ring-2 ring-primary' : ''
      } ${compact ? 'aspect-video' : ''}`}
      onClick={onToggleSelect}
    >
      <img 
        src={frame.imageUrl} 
        alt={`Frame at ${frame.timestamp}`} 
        className={`w-full ${compact ? '' : 'aspect-video'} object-cover cursor-pointer`}
      />
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 bg-primary rounded-full p-1">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      
      {/* Timestamp badge */}
      <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm p-1 text-center">
        <span className="text-xs font-mono">{frame.timestamp}</span>
      </div>
    </div>
  );
};
