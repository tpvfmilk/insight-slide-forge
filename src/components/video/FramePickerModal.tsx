
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Camera, Trash2, Plus, RefreshCw, AlertCircle, Rewind, FastForward } from "lucide-react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";

// Create a separate interface for frames with blobs that extends ExtractedFrame
interface CapturedFrameWithBlob {
  timestamp: string;
  imageUrl: string;
  id?: string;
  isPlaceholder?: boolean;
  blob: Blob;
}

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
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrameWithBlob[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekingValue, setSeekingValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadAttempts, setLoadAttempts] = useState(0);
  
  // Reset state when opening modal
  useEffect(() => {
    if (open) {
      setSelectedFrames(existingFrames || []);
      setVideoError(null);
      setIsVideoLoaded(false);
      setIsLoadingVideo(true);
      setLoadAttempts(0);
      setCurrentTime(0);
      setSeekingValue(0);
      
      // Try to load the video
      loadVideo();
    }
  }, [open, existingFrames]);
  
  // Function to load the video
  const loadVideo = async () => {
    if (!videoPath) {
      setVideoError("No video path provided");
      setIsLoadingVideo(false);
      return;
    }
    
    setIsLoadingVideo(true);
    setVideoError(null);
    
    try {
      console.log(`Attempting to load video from path: ${videoPath}`);
      
      // Extract bucket and file path
      let bucket = 'video_uploads';
      let filePath = videoPath;
      
      // If path includes '/', extract the actual file path without bucket name
      if (videoPath.includes('/')) {
        const pathParts = videoPath.split('/');
        if (pathParts.length > 1) {
          filePath = pathParts.pop() || '';
          bucket = pathParts.join('/');
        }
      }
      
      console.log(`Getting signed URL for ${bucket}/${filePath}`);
      
      // Get a fresh signed URL with longer expiry
      const { data, error } = await supabase
        .storage
        .from(bucket)
        .createSignedUrl(filePath, 7200); // 2 hour expiry
        
      if (error || !data?.signedUrl) {
        console.error("Error getting signed URL:", error);
        
        // Try alternate methods to get video URL
        if (projectId) {
          // If we have project ID, try to get source URL from project
          const { data: projectData } = await supabase
            .from('projects')
            .select('source_url, source_file_path')
            .eq('id', projectId)
            .single();
            
          if (projectData?.source_url) {
            console.log("Using project source URL as fallback");
            setVideoUrl(projectData.source_url);
            return;
          } else if (projectData?.source_file_path) {
            // Try with the source file path from project
            const altPath = projectData.source_file_path;
            const altBucket = 'video_uploads';
            
            const { data: altData, error: altError } = await supabase
              .storage
              .from(altBucket)
              .createSignedUrl(altPath, 7200);
              
            if (!altError && altData?.signedUrl) {
              console.log("Using alternate file path from project");
              setVideoUrl(altData.signedUrl);
              return;
            }
          }
        }
        
        throw new Error("Couldn't create access link for video");
      }
      
      console.log("Got signed URL for video");
      setVideoUrl(data.signedUrl);
    } catch (error) {
      console.error("Error getting fresh video URL:", error);
      setVideoError("Failed to access video. The video might be unavailable or the format is not supported.");
    } finally {
      setIsLoadingVideo(false);
    }
  };
  
  // Update time display when video is playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const updateTime = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
        setSeekingValue(video.currentTime);
      }
    };
    
    video.addEventListener('timeupdate', updateTime);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
    };
  }, [isSeeking]);

  // Handle video duration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
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

  // Seek back 5 seconds
  const seekBack = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, video.currentTime - 5);
    setCurrentTime(video.currentTime);
    setSeekingValue(video.currentTime);
  };

  // Seek forward 5 seconds
  const seekForward = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
    setCurrentTime(video.currentTime);
    setSeekingValue(video.currentTime);
  };

  // Handle seeking via slider
  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekChange = (value: number[]) => {
    setSeekingValue(value[0]);
  };

  const handleSeekEnd = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = seekingValue;
    setCurrentTime(seekingValue);
    setIsSeeking(false);
  };
  
  // Format time display (seconds to MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle video load events
  const handleVideoLoaded = () => {
    setIsVideoLoaded(true);
    setVideoError(null);
    setIsLoadingVideo(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };
  
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error("Video error:", e);
    setVideoError("Failed to load video. Please check the video file format and try again.");
    setIsVideoLoaded(false);
    setIsLoadingVideo(false);
  };
  
  // Retry loading video
  const retryLoadVideo = () => {
    setLoadAttempts(prev => prev + 1);
    loadVideo();
  };
  
  // Capture current frame with improved method to prevent black frames
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !projectId) return;
    
    // Pause the video to ensure stable frame
    video.pause();
    setIsPlaying(false);
    
    // Force the browser to render the current frame
    setTimeout(() => {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current frame on the canvas
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        toast.error("Failed to capture frame");
        return;
      }
      
      // Fill with white background first to ensure no transparency issues
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw the video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Check if canvas has content (not a black frame)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let hasContent = false;
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        
        // If any pixel is not black, we have content
        if (r > 10 || g > 10 || b > 10) {
          hasContent = true;
          break;
        }
      }
      
      if (!hasContent) {
        toast.error("Frame appears to be black. Please try at a different position in the video.");
        return;
      }
      
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
        
        // Create a new extracted frame
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl,
          timestamp
        };
        
        // Create a captured frame with blob
        const capturedFrame: CapturedFrameWithBlob = {
          ...newFrame,
          blob
        };
        
        // Add to captured frames
        setCapturedFrames(prev => [...prev, capturedFrame]);
        
        // Auto-select the newly captured frame
        setSelectedFrames(prev => [...prev, newFrame]);
        
        toast.success(`Frame captured at ${timestamp}`);
      }, 'image/jpeg', 0.95);
    }, 300); // Small delay to ensure the frame is fully rendered
  };
  
  // Remove a frame from selection
  const removeFrame = (frameId: string) => {
    setSelectedFrames(prev => prev.filter(frame => frame.id !== frameId));
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
        
        {/* Main content area */}
        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* Video player */}
          <div className="relative w-full bg-black aspect-video rounded-md overflow-hidden">
            {isLoadingVideo ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                <RefreshCw className="h-8 w-8 animate-spin mr-2" />
                <span>Loading video...</span>
              </div>
            ) : videoError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 text-center">
                <div>
                  <AlertCircle className="h-10 w-10 mb-2 mx-auto text-destructive" />
                  <p className="mb-4">{videoError}</p>
                  <Button 
                    variant="secondary" 
                    onClick={retryLoadVideo}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Loading Video
                  </Button>
                </div>
              </div>
            ) : null}
            
            <video
              ref={videoRef}
              src={videoUrl || undefined}
              className="w-full h-full"
              crossOrigin="anonymous"
              onLoadedData={handleVideoLoaded}
              onLoadedMetadata={handleVideoLoaded}
              onError={handleVideoError}
            >
              Your browser does not support the video tag.
            </video>
            
            {/* Video controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3 flex flex-col space-y-2">
              <div className="flex items-center space-x-4 w-full">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={seekBack}
                  className="text-white hover:bg-white/20"
                  disabled={!isVideoLoaded}
                >
                  <Rewind className="h-5 w-5" />
                </Button>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/20"
                  disabled={!isVideoLoaded}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={seekForward}
                  className="text-white hover:bg-white/20"
                  disabled={!isVideoLoaded}
                >
                  <FastForward className="h-5 w-5" />
                </Button>
                
                <div className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                
                <div className="flex-1"></div>
                
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={captureFrame}
                  className="flex items-center space-x-1"
                  disabled={!isVideoLoaded}
                >
                  <Camera className="h-4 w-4 mr-1" />
                  Capture Frame
                </Button>
              </div>
              
              {/* Video seek slider */}
              <div className="px-1">
                <Slider
                  value={[seekingValue]}
                  min={0}
                  max={duration || 100}
                  step={0.01}
                  onValueChange={handleSeekChange}
                  onValueCommit={handleSeekEnd}
                  onPointerDown={handleSeekStart}
                  disabled={!isVideoLoaded || duration === 0}
                  className="cursor-pointer"
                />
              </div>
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
                          onClick={() => removeFrame(frame.id as string)}
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
