import { useState, useRef, useEffect } from "react";
import { SafeDialog, SafeDialogContent } from "@/components/ui/safe-dialog";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Search, X, Trash2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUIReset } from "@/context/UIResetContext";
import { cleanupFrameSelectorDialog } from "@/utils/uiUtils";
import { getFrameStatistics, purgeUnusedFrames } from "@/utils/frameUtils";
import { toast } from "@/components/ui/use-toast"; 
import { Separator } from "@/components/ui/separator";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { Slide } from "@/utils/frameUtils";

interface FrameSelectorProps {
  open: boolean;
  onClose: () => void;
  availableFrames: ExtractedFrame[];
  selectedFrames: ExtractedFrame[];
  onSelect: (frames: ExtractedFrame[]) => void;
  projectId?: string;
  onRefresh?: () => Promise<void>;
  slides?: Slide[];
}

export const FrameSelector: React.FC<FrameSelectorProps> = ({
  open,
  onClose,
  availableFrames,
  selectedFrames,
  onSelect,
  projectId,
  onRefresh,
  slides = []
}) => {
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<ExtractedFrame[]>([]);
  const [isPurgingFrames, setIsPurgingFrames] = useState(false);
  const { registerUIElement, unregisterUIElement } = useUIReset();
  const elementId = useRef(`frame-selector-${Math.random().toString(36).substring(2, 9)}`);
  
  // Initialize with the provided selected frames
  useEffect(() => {
    setLocalSelected(selectedFrames);
  }, [selectedFrames, open]);

  // Register with UIResetContext when dialog opens
  useEffect(() => {
    if (open) {
      registerUIElement({
        id: elementId.current,
        type: 'dialog',
        close: () => {
          handleClose();
        },
      });
      
      return () => {
        unregisterUIElement(elementId.current);
        cleanupFrameSelectorDialog();
      };
    }
  }, [open, registerUIElement, unregisterUIElement]);

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

  // New function to remove a frame from selection
  const removeSelectedFrame = (e: React.MouseEvent, frame: ExtractedFrame) => {
    e.stopPropagation(); // Prevent triggering the toggle selection
    setLocalSelected(prev => prev.filter(f => f.id !== frame.id));
    toast({
      title: "Frame removed",
      description: "Frame has been removed from selection",
      duration: 2000,
    });
  };

  const handleConfirm = () => {
    onSelect(localSelected);
    handleClose();
  };
  
  const handleClose = () => {
    // Clean up any potential UI blockers specifically for frame selector
    cleanupFrameSelectorDialog();
    // Call the provided onClose function
    onClose();
  };

  const isSelected = (frame: ExtractedFrame) => {
    return localSelected.some(f => f.id === frame.id);
  };
  
  // Function to handle purging unused frames
  const handlePurgeUnusedFrames = async () => {
    if (!projectId || isPurgingFrames) return;
    
    setIsPurgingFrames(true);
    
    // Create a loading toast instead of using toast.loading
    const toastId = "purge-frames";
    toast({
      id: toastId,
      title: "Purging unused frames",
      description: "Please wait while we clean up unused frames...",
    });
    
    try {
      // Ensure slides is treated as appropriate type for purgeUnusedFrames
      const success = await purgeUnusedFrames(
        projectId, 
        availableFrames, 
        slides as Slide[]
      );
      
      if (success && onRefresh) {
        await onRefresh();
      }
      
      // Dismiss the toast using toast({ id }) instead of toast.dismiss
      toast({
        id: toastId,
        title: "Success",
        description: "Successfully purged unused frames",
      });
      
      if (success) {
        // Close dialog after successful purge
        handleClose();
      }
    } catch (error) {
      console.error("Error purging frames:", error);
      // Show error toast
      toast({
        id: toastId,
        variant: "destructive",
        title: "Error",
        description: "Failed to purge unused frames",
      });
    } finally {
      setIsPurgingFrames(false);
    }
  };
  
  // Calculate frame statistics
  const frameStats = slides && availableFrames 
    ? getFrameStatistics(availableFrames, slides as Slide[])
    : { totalExtracted: 0, usedCount: 0, unusedCount: 0 };

  return (
    <SafeDialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}
    >
      <SafeDialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Frames</DialogTitle>
        </DialogHeader>
        
        {/* Frame statistics section */}
        <div className="bg-muted/30 p-3 rounded-md mb-3">
          <h3 className="text-sm font-medium mb-2">Frame Statistics</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-background p-2 rounded-md">
              <div className="font-medium">Total Extracted</div>
              <div className="text-lg">{frameStats.totalExtracted}</div>
            </div>
            <div className="bg-background p-2 rounded-md">
              <div className="font-medium">Used in Slides</div>
              <div className="text-lg">{frameStats.usedCount}</div>
            </div>
            <div className="bg-background p-2 rounded-md">
              <div className="font-medium">Unused Frames</div>
              <div className="text-lg">{frameStats.unusedCount}</div>
            </div>
          </div>
          
          {frameStats.unusedCount > 0 && projectId && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handlePurgeUnusedFrames}
              disabled={isPurgingFrames}
              className="mt-2 w-full"
            >
              {isPurgingFrames ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Purging...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Purge {frameStats.unusedCount} Unused Frame{frameStats.unusedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </div>
        
        <Separator className="my-1" />
        
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

        {/* Fixed maxHeight and added proper overflow styling */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(80vh - 300px)" }}>
          {filteredFrames.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No frames match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-1 py-2">
              {filteredFrames.map((frame) => (
                <div 
                  key={frame.id || frame.timestamp}
                  className={`relative rounded-md border overflow-hidden cursor-pointer transition-all group ${
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
                  
                  {/* Add remove button that appears on hover if the frame is selected */}
                  {isSelected(frame) && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-7 w-7 rounded-full" 
                        onClick={(e) => removeSelectedFrame(e, frame)}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove frame</span>
                      </Button>
                    </div>
                  )}
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
            <Button variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-2" />
              Confirm Selection
            </Button>
          </div>
        </div>
      </SafeDialogContent>
    </SafeDialog>
  );
};
