
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ExtractedFrame {
  imageUrl: string;
  timestamp: string;
  id: string;
}

interface FrameSelectorProps {
  open: boolean;
  onClose: () => void;
  availableFrames: ExtractedFrame[];
  selectedFrames: ExtractedFrame[];
  onSelect: (frames: ExtractedFrame[]) => void;
}

export const FrameSelector: React.FC<FrameSelectorProps> = ({
  open,
  onClose,
  availableFrames,
  selectedFrames,
  onSelect
}) => {
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<ExtractedFrame[]>([]);
  
  // Initialize with the provided selected frames
  useEffect(() => {
    setLocalSelected(selectedFrames);
  }, [selectedFrames, open]);

  // Filter frames based on search query
  const filteredFrames = availableFrames.filter(frame => 
    frame.timestamp.toLowerCase().includes(search.toLowerCase())
  );

  const toggleFrameSelection = (frame: ExtractedFrame) => {
    setLocalSelected(prev => {
      const isSelected = prev.some(f => f.id === frame.id);
      
      if (isSelected) {
        // Remove the frame
        return prev.filter(f => f.id !== frame.id);
      } else {
        // Add the frame
        return [...prev, frame];
      }
    });
  };

  const handleConfirm = () => {
    onSelect(localSelected);
    onClose();
  };

  const isSelected = (frame: ExtractedFrame) => {
    return localSelected.some(f => f.id === frame.id);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Frames</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by timestamp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocalSelected([])}>
            Clear
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredFrames.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No frames match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-1 py-2">
              {filteredFrames.map((frame) => (
                <div 
                  key={frame.id}
                  className={`relative rounded-md border overflow-hidden cursor-pointer transition-all ${
                    isSelected(frame) ? 'ring-2 ring-primary' : 'hover:opacity-90'
                  }`}
                  onClick={() => toggleFrameSelection(frame)}
                >
                  <img
                    src={frame.imageUrl}
                    alt={`Frame at ${frame.timestamp}`}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-2 flex justify-between items-center">
                    <span className="text-xs font-mono">{frame.timestamp}</span>
                    {isSelected(frame) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t mt-2">
          <div className="text-sm text-muted-foreground">
            {localSelected.length} frame(s) selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-2" />
              Confirm Selection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
