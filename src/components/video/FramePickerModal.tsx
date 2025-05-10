
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Film, Clock, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";
import { clientExtractFramesFromVideo } from "@/services/clientFrameExtractionService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchProjectVideos, ProjectVideo } from "@/services/projectVideoService";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

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
  const [projectVideos, setProjectVideos] = useState<ProjectVideo[]>([]);
  const [selectedVideoPath, setSelectedVideoPath] = useState(videoPath);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Fetch project videos when the modal opens
  useEffect(() => {
    if (open && projectId) {
      const loadProjectVideos = async () => {
        try {
          const videos = await fetchProjectVideos(projectId);
          setProjectVideos(videos);
          console.log("Loaded project videos:", videos);
        } catch (error) {
          console.error("Error loading project videos:", error);
          toast.error("Failed to load project videos");
        }
      };
      
      loadProjectVideos();
    }
  }, [open, projectId]);
  
  useEffect(() => {
    setSelectedFrames(existingFrames || []);
  }, [existingFrames, open]);
  
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
    
    if (!selectedVideoPath) {
      toast.error("Please select a video for extraction");
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
        selectedVideoPath,
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
  
  // Jump to timestamp in video
  const jumpToTimestamp = (timestamp: string) => {
    if (videoRef.current) {
      // Parse timestamp in format "00:00:00" to seconds
      const parts = timestamp.split(':');
      let seconds = 0;
      
      if (parts.length === 3) {
        seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
      } else if (parts.length === 2) {
        seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
      } else if (parts.length === 1) {
        seconds = parseFloat(parts[0]);
      }
      
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(err => {
        console.error("Error playing video:", err);
      });
    }
  };

  // Handle video selection change
  const handleVideoChange = (value: string) => {
    setSelectedVideoPath(value);
    
    // Reset video player if the ref exists
    if (videoRef.current) {
      videoRef.current.load();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogTitle>Select Frames</DialogTitle>
        
        {/* Video selector dropdown */}
        <div className="mb-4">
          <Select value={selectedVideoPath} onValueChange={handleVideoChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a video" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Project Videos</SelectLabel>
                {projectVideos.map((video) => (
                  <SelectItem 
                    key={video.id} 
                    value={video.source_file_path || ""}
                    disabled={!video.source_file_path}
                  >
                    {video.title || video.video_metadata?.original_file_name || "Untitled video"}
                  </SelectItem>
                ))}
                {projectVideos.length === 0 && (
                  <SelectItem value="_empty" disabled>No videos available</SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        
        <Tabs 
          value={selectedTab} 
          onValueChange={(value) => setSelectedTab(value as "existing" | "all" | "extract")} 
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="existing">Existing Frames</TabsTrigger>
            <TabsTrigger value="all">All Frames</TabsTrigger>
            <TabsTrigger value="extract">Extract New Frames</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <TabsContent value="existing" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex flex-row gap-4 h-full">
                {/* Video Player */}
                <div className="w-1/2 aspect-video bg-black rounded-md overflow-hidden">
                  <video
                    ref={videoRef}
                    src={selectedVideoPath}
                    className="w-full h-full"
                    controls
                    crossOrigin="anonymous"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                
                {/* Selected frames content */}
                <div className="w-1/2 overflow-auto">
                  {existingFrames && existingFrames.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Selected Frames</h3>
                      <p className="text-sm text-muted-foreground">
                        {existingFrames.length} frame(s) selected for this slide.
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-muted-foreground">No existing frames for this slide.</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Film strip at bottom */}
              <div className="h-28 mt-4 border-t pt-4">
                {existingFrames && existingFrames.length > 0 ? (
                  <ScrollArea className="h-full">
                    <div className="flex gap-2">
                      {existingFrames.map((frame) => (
                        <div 
                          key={frame.imageUrl} 
                          className="relative h-24 aspect-video flex-shrink-0 cursor-pointer"
                          onClick={() => jumpToTimestamp(frame.timestamp)}
                        >
                          <img
                            src={frame.imageUrl}
                            alt={`Frame at ${frame.timestamp}`}
                            className="h-full w-full object-cover rounded-md"
                          />
                          <Badge className="absolute bottom-1 right-1 text-xs">{frame.timestamp}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">No frames available</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="all" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex flex-row gap-4 h-full">
                {/* Video Player */}
                <div className="w-1/2 aspect-video bg-black rounded-md overflow-hidden">
                  <video
                    ref={videoRef}
                    src={selectedVideoPath}
                    className="w-full h-full"
                    controls
                    crossOrigin="anonymous"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                
                {/* All frames content */}
                <div className="w-1/2 flex flex-col">
                  <div className="flex items-center space-x-2 mb-4">
                    <Search className="h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search by timestamp..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex-1 overflow-auto">
                    {filteredFrames.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredFrames.map((frame) => (
                          <div 
                            key={frame.imageUrl} 
                            className="relative cursor-pointer"
                            onClick={() => jumpToTimestamp(frame.timestamp)}
                          >
                            <img
                              src={frame.imageUrl}
                              alt={`Frame at ${frame.timestamp}`}
                              className="w-full aspect-video rounded-md"
                            />
                            <Badge className="absolute top-2 right-2">{frame.timestamp}</Badge>
                            <div className="absolute bottom-2 right-2 bg-background/80 rounded-full p-1">
                              <Checkbox
                                checked={isFrameSelected(frame)}
                                onCheckedChange={() => handleFrameSelect(frame)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-muted-foreground">No frames found.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Frame library at bottom */}
              <div className="mt-4 border-t pt-4">
                <h3 className="text-sm font-medium mb-2">All Available Frames</h3>
                <ScrollArea className="h-28">
                  <div className="flex gap-2">
                    {allExtractedFrames.map((frame) => (
                      <div 
                        key={frame.imageUrl} 
                        className={`relative h-24 aspect-video flex-shrink-0 cursor-pointer ${
                          isFrameSelected(frame) ? "border-2 border-primary" : ""
                        }`}
                        onClick={() => handleFrameSelect(frame)}
                      >
                        <img
                          src={frame.imageUrl}
                          alt={`Frame at ${frame.timestamp}`}
                          className="h-full w-full object-cover rounded-md"
                        />
                        <Badge className="absolute bottom-1 right-1 text-xs">{frame.timestamp}</Badge>
                      </div>
                    ))}
                    {allExtractedFrames.length === 0 && (
                      <div className="h-full flex items-center justify-center px-4">
                        <p className="text-muted-foreground text-sm">No frames available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
            
            <TabsContent value="extract" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex flex-row gap-4 h-full">
                {/* Video Player */}
                <div className="w-1/2 aspect-video bg-black rounded-md overflow-hidden">
                  <video
                    ref={videoRef}
                    src={selectedVideoPath}
                    className="w-full h-full"
                    controls
                    crossOrigin="anonymous"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                
                {/* Extract frames content */}
                <div className="w-1/2">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="timestamps" className="block text-sm font-medium mb-1">Timestamps (comma-separated):</label>
                      <Input
                        type="text"
                        id="timestamps"
                        placeholder="e.g., 00:10, 00:30, 01:00"
                        value={extractionTimestamps}
                        onChange={(e) => setExtractionTimestamps(e.target.value)}
                      />
                    </div>
                    
                    <Button 
                      onClick={handleExtractFrames} 
                      disabled={isExtracting}
                      className="w-full"
                    >
                      {isExtracting ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        "Extract Frames"
                      )}
                    </Button>
                    
                    <div className="overflow-y-auto">
                      {newFrames.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {newFrames.map((frame) => (
                            <div key={frame.imageUrl} className="relative">
                              <img
                                src={frame.imageUrl}
                                alt={`Frame at ${frame.timestamp}`}
                                className="w-full aspect-video rounded-md"
                              />
                              <Badge className="absolute top-2 right-2">{frame.timestamp}</Badge>
                              <div className="absolute bottom-2 right-2 bg-background/80 rounded-full p-1">
                                <Checkbox
                                  checked={isFrameSelected(frame)}
                                  onCheckedChange={() => handleFrameSelect(frame)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Frame library at bottom */}
              <div className="mt-4 border-t pt-4">
                <h3 className="text-sm font-medium mb-2">Extracted Frames</h3>
                <ScrollArea className="h-28">
                  <div className="flex gap-2">
                    {newFrames.map((frame) => (
                      <div 
                        key={frame.imageUrl} 
                        className={`relative h-24 aspect-video flex-shrink-0 cursor-pointer ${
                          isFrameSelected(frame) ? "border-2 border-primary" : ""
                        }`}
                        onClick={() => handleFrameSelect(frame)}
                      >
                        <img
                          src={frame.imageUrl}
                          alt={`Frame at ${frame.timestamp}`}
                          className="h-full w-full object-cover rounded-md"
                        />
                        <Badge className="absolute bottom-1 right-1 text-xs">{frame.timestamp}</Badge>
                      </div>
                    ))}
                    {newFrames.length === 0 && (
                      <div className="h-full flex items-center justify-center px-4">
                        <p className="text-muted-foreground text-sm">No frames extracted yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>
        
        <div className="flex justify-end pt-2 border-t mt-2">
          <Button onClick={handleApplyFrames} className="gap-1">
            Apply {selectedFrames.length > 0 ? `${selectedFrames.length} ` : ''}Frames
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
