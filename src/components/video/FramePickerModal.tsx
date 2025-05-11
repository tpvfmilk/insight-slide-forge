
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Camera, Trash2, Plus } from "lucide-react";
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
import { timestampToSeconds } from "@/utils/formatUtils";

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
  const [selectedFrames, setSelectedFrames] = useState<ExtractedFrame[]>(existingFrames || []);
  const [capturedFrames, setCapturedFrames] = useState<ExtractedFrame[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [projectVideos, setProjectVideos] = useState<ProjectVideo[]>([]);
  const [selectedVideoPath, setSelectedVideoPath] = useState(videoPath);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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
  
  // Update time display when video is playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const updateTime = () => {
      setCurrentTime(video.currentTime);
    };
    
    video.addEventListener('timeupdate', updateTime);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
    };
  }, []);
  
  // Handle video playback control
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(error => {
        console.error("Error playing video:", error);
        toast.error("Failed to play video");
      });
    }
    
    setIsPlaying(!isPlaying);
  };

  // Update isPlaying state based on video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  // Format time display (seconds to MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Capture current frame
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !projectId) return;
    
    // Pause the video
    video.pause();
    setIsPlaying(false);
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the current frame on the canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error("Failed to capture frame");
      return;
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Failed to capture frame");
        return;
      }
      
      // Generate unique ID for the frame
      const frameId = `frame-${Date.now()}`;
      
      // Format timestamp
      const timestamp = formatTime(video.currentTime);
      
      // Create a URL for the blob
      const imageUrl = URL.createObjectURL(blob);
      
      // Create a new captured frame
      const newFrame: ExtractedFrame = {
        id: frameId,
        imageUrl,
        timestamp,
        blob
      };
      
      // Add to captured frames
      setCapturedFrames(prev => [...prev, newFrame]);
      
      // Auto-select the newly captured frame
      setSelectedFrames(prev => [...prev, newFrame]);
      
      toast.success(`Frame captured at ${timestamp}`);
    }, 'image/jpeg', 0.95);
  };
  
  // Remove a frame from selection
  const removeFrame = (frameId: string) => {
    setSelectedFrames(prev => prev.filter(frame => frame.id !== frameId));
  };

  // Handle video selection change
  const handleVideoChange = (value: string) => {
    setSelectedVideoPath(value);
    
    // Reset video player if the ref exists
    if (videoRef.current) {
      videoRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };
  
  // Apply selected frames to slide
  const handleApplyFrames = () => {
    onFramesSelected(selectedFrames);
    onClose();
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
        
        {/* Main content area */}
        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* Video player */}
          <div className="relative w-full bg-black aspect-video rounded-md overflow-hidden">
            <video
              ref={videoRef}
              src={selectedVideoPath}
              className="w-full h-full"
              crossOrigin="anonymous"
            >
              Your browser does not support the video tag.
            </video>
            
            {/* Video controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3 flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={togglePlayPause}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              
              <div className="text-white text-sm">
                {formatTime(currentTime)}
              </div>
              
              <div className="flex-1"></div>
              
              <Button 
                variant="secondary" 
                size="sm"
                onClick={captureFrame}
                className="flex items-center space-x-1"
              >
                <Camera className="h-4 w-4 mr-1" />
                Capture Frame
              </Button>
            </div>
          </div>
          
          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden"></canvas>
          
          {/* Selected frames section */}
          <div className="flex flex-col space-y-2">
            <h3 className="text-sm font-medium">Selected Frames</h3>
            
            <div className="flex-1 min-h-[100px] bg-muted/30 rounded-md overflow-hidden">
              <ScrollArea className="h-[140px]">
                {selectedFrames.length > 0 ? (
                  <div className="flex gap-2 p-2">
                    {selectedFrames.map((frame) => (
                      <div 
                        key={frame.id} 
                        className="relative h-24 aspect-video flex-shrink-0"
                      >
                        <img
                          src={frame.imageUrl}
                          alt={`Frame at ${frame.timestamp}`}
                          className="h-full w-full object-cover rounded-md"
                        />
                        <Badge className="absolute top-1 left-1 text-xs">{frame.timestamp}</Badge>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-6 w-6 absolute top-1 right-1"
                          onClick={() => removeFrame(frame.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">No frames selected</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t mt-2">
          <div className="text-sm text-muted-foreground">
            {selectedFrames.length} frame(s) selected
          </div>
          <Button onClick={handleApplyFrames} className="gap-1">
            <Plus className="h-4 w-4 mr-1" />
            Insert to Slide
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
