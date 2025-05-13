import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LocalExtractedFrame } from "@/components/slides/editor/SlideEditorTypes";
import { toast } from "sonner";

interface FramePickerModalProps {
  open: boolean;
  onClose: () => void;
  allFrames: LocalExtractedFrame[];
  initialSelectedFrames?: LocalExtractedFrame[];
  onApplyFrames: (frames: LocalExtractedFrame[]) => void;
}

export function FramePickerModal({
  open,
  onClose,
  allFrames,
  initialSelectedFrames = [],
  onApplyFrames
}: FramePickerModalProps) {
  const [selectedFrames, setSelectedFrames] = useState<LocalExtractedFrame[]>(initialSelectedFrames);
  
  // Reset selected frames when modal opens
  useEffect(() => {
    if (open) {
      setSelectedFrames(initialSelectedFrames);
    }
  }, [open, initialSelectedFrames]);
  
  const toggleFrameSelection = (frame: LocalExtractedFrame) => {
    setSelectedFrames(prevSelected => {
      const isSelected = prevSelected.some(f => f.id === frame.id);
      if (isSelected) {
        return prevSelected.filter(f => f.id !== frame.id);
      } else {
        return [...prevSelected, frame];
      }
    });
  };
  
  const handleApplyFrames = () => {
    if (selectedFrames.length === 0) {
      toast.warning("Please select at least one frame");
      return;
    }
    
    onApplyFrames(selectedFrames);
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Select Frames</DialogTitle>
        </DialogHeader>
        
        <div className="text-sm text-muted-foreground mb-4">
          Select one or more frames to apply to the current slide. Frames will remain in the library after being applied.
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto max-h-[60vh]">
          {allFrames.map(frame => (
            <div 
              key={frame.id}
              className={`relative aspect-video rounded-md overflow-hidden cursor-pointer border-2 ${
                selectedFrames.some(f => f.id === frame.id) ? 'border-primary' : 'border-transparent'
              }`}
              onClick={() => toggleFrameSelection(frame)}
            >
              <img src={frame.imageUrl} alt={`Frame at ${frame.timestamp}`} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1">
                {frame.timestamp}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-between mt-4">
          <div className="text-sm">
            {selectedFrames.length} frame{selectedFrames.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleApplyFrames}>
              Apply to Slide
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
