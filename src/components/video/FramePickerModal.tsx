
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Film, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";
import { clientExtractFramesFromVideo } from "@/services/clientFrameExtractionService";

export interface FramePickerModalProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  projectId: string;
  onFramesSelected: (frames: ExtractedFrame[]) => void;
  allExtractedFrames: ExtractedFrame[];
  existingFrames?: ExtractedFrame[];
}

export const FramePickerModal: React.FC<FramePickerModalProps> = ({
  open,
  onClose,
  videoPath,
  projectId,
  onFramesSelected,
  allExtractedFrames = [],
  existingFrames = []
}) => {
  const [selectedTab, setSelectedTab] = useState<"existing" | "all" | "extract">("existing");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFrames, setSelectedFrames] = useState<ExtractedFrame[]>(existingFrames || []);
  const [isExtracting, setIsExtracting] = useState(false);
  const [newFrames, setNewFrames] = useState<ExtractedFrame[]>([]);
  const [extractionTimestamps, setExtractionTimestamps] = useState("");
  
  // Filtered frames based on search term
  const filteredFrames = allExtractedFrames.filter(frame =>
    frame.timestamp.includes(searchTerm)
  );
  
  // Handler for selecting/deselecting a frame
  const handleFrameSelect = (frame: ExtractedFrame) => {
    const isSelected = selectedFrames.some(f => f.imageUrl === frame.imageUrl);
    
    if (isSelected) {
      setSelectedFrames(prev => prev.filter(f => f.imageUrl !== frame.imageUrl));
    } else {
      setSelectedFrames(prev => [...prev, frame]);
    }
  };
  
  // Check if a frame is selected
  const isFrameSelected = (frame: ExtractedFrame) => {
    return selectedFrames.some(f => f.imageUrl === frame.imageUrl);
  };
  
  // Handle applying the selected frames
  const handleApplyFrames = () => {
    onFramesSelected(selectedFrames);
    onClose();
  };
  
  // Handle extracting new frames
  const handleExtractFrames = async () => {
    if (!extractionTimestamps) {
      toast.error("Please enter timestamps for extraction");
      return;
    }
    
    const timestampsArray = extractionTimestamps.split(",").map(s => s.trim());
    
    if (timestampsArray.length === 0) {
      toast.error("Please enter valid timestamps");
      return;
    }
    
    setIsExtracting(true);
    
    try {
      const result = await clientExtractFramesFromVideo(
        projectId,
        videoPath,
        timestampsArray
      );
      
      if (result.success && result.frames) {
        setNewFrames(result.frames);
        toast.success(`Successfully extracted ${result.frames.length} frames`);
      } else {
        toast.error(result.error || "Failed to extract frames");
      }
    } catch (error) {
      console.error("Frame extraction error:", error);
      toast.error("Failed to extract frames");
    } finally {
      setIsExtracting(false);
    }
  };
  
  // All extracted frames
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogTitle>Select Frames</DialogTitle>
        
        <Tabs 
          value={selectedTab} 
          onValueChange={(value: "existing" | "all" | "extract") => setSelectedTab(value)} 
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="existing">Existing Frames</TabsTrigger>
            <TabsTrigger value="all">All Frames</TabsTrigger>
            <TabsTrigger value="extract">Extract New Frames</TabsTrigger>
          </TabsList>
          
          <TabsContent value="existing" className="space-y-4">
            {existingFrames && existingFrames.length > 0 ? (
              <div className="grid grid-cols-4 gap-4">
                {existingFrames.map((frame) => (
                  <div key={frame.imageUrl} className="relative">
                    <img
                      src={frame.imageUrl}
                      alt={`Frame at ${frame.timestamp}`}
                      className="w-full aspect-video rounded-md"
                    />
                    <Badge className="absolute top-2 right-2">{frame.timestamp}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p>No existing frames for this slide.</p>
            )}
          </TabsContent>
          
          <TabsContent value="all" className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by timestamp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {filteredFrames.length > 0 ? (
              <div className="grid grid-cols-4 gap-4">
                {filteredFrames.map((frame) => (
                  <div key={frame.imageUrl} className="relative">
                    <img
                      src={frame.imageUrl}
                      alt={`Frame at ${frame.timestamp}`}
                      className="w-full aspect-video rounded-md"
                    />
                    <Badge className="absolute top-2 right-2">{frame.timestamp}</Badge>
                    <Checkbox
                      className="absolute bottom-2 right-2"
                      checked={isFrameSelected(frame)}
                      onCheckedChange={() => handleFrameSelect(frame)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p>No frames found.</p>
            )}
          </TabsContent>
          
          <TabsContent value="extract" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="timestamps">Timestamps (comma-separated):</label>
                <Input
                  type="text"
                  id="timestamps"
                  placeholder="e.g., 00:10, 00:30, 01:00"
                  value={extractionTimestamps}
                  onChange={(e) => setExtractionTimestamps(e.target.value)}
                />
              </div>
              
              <Button onClick={handleExtractFrames} disabled={isExtracting}>
                {isExtracting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  "Extract Frames"
                )}
              </Button>
            </div>
            
            {newFrames.length > 0 && (
              <div className="grid grid-cols-4 gap-4">
                {newFrames.map((frame) => (
                  <div key={frame.imageUrl} className="relative">
                    <img
                      src={frame.imageUrl}
                      alt={`Frame at ${frame.timestamp}`}
                      className="w-full aspect-video rounded-md"
                    />
                    <Badge className="absolute top-2 right-2">{frame.timestamp}</Badge>
                    <Checkbox
                      className="absolute bottom-2 right-2"
                      checked={isFrameSelected(frame)}
                      onCheckedChange={() => handleFrameSelect(frame)}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end">
          <Button onClick={handleApplyFrames}>
            Apply Frames
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
