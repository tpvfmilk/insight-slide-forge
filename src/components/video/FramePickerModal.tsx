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
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";

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
  const [capturedTimemarks, setCapturedTimemarks] = useState<number[]>([]);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);
  
  // Reset state when opening modal
  useEffect(() => {
    if (open) {
      // Sort existing frames by timestamp if they exist
      const sortedFrames = [...(existingFrames || [])].sort((a, b) => {
        return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
      });
      
      setSelectedFrames(sortedFrames);
      setVideoError(null);
      setIsVideoLoaded(false);
      setIsLoadingVideo(true);
      setLoadAttempts(0);
      setCurrentTime(0);
      setSeekingValue(0);
      setCapturedTimemarks([]);
      setIsCapturingFrame(false);
      
      // Try to load the video
      loadVideo();
    }
  }, [open, existingFrames]);
  
  // Utility function to convert timestamp string to seconds
  const timeToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };
  
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
  
  // Capture current frame using the improved extraction service
  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl || isCapturingFrame) return;
    
    try {
      setIsCapturingFrame(true);
      
      // Pause the video
      video.pause();
      setIsPlaying(false);
      
      // Store current time
      const currentTimePosition = video.currentTime;
      const timestamp = formatTime(currentTimePosition);
      
      toast.loading(`Capturing frame at ${timestamp}...`, {
        id: 'capture-frame'
      });
      
      // Use our advanced frame extraction to get a good quality frame
      const extractedFrames = await extractFramesFromVideoUrl(
        videoUrl, 
        [timestamp],
        undefined,
        duration,
        {
          captureAttempts: 5, // More attempts
          captureOffsets: [-0.1, 0, 0.1, 0.2, -0.2, 0.5, -0.5, 0.8, -0.8], // More offsets
          minContentThreshold: 0.03
        }
      );
      
      if (extractedFrames && extractedFrames.length > 0) {
        const { frame, timestamp: extractedTimestamp } = extractedFrames[0];
        
        // Create a URL for the blob
        const imageUrl = URL.createObjectURL(frame);
        
        // Create a new extracted frame
        const frameId = `frame-${Date.now()}-${extractedTimestamp}`;
        
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl,
          timestamp: extractedTimestamp,
          isPlaceholder: false
        };
        
        // Create a captured frame with blob
        const capturedFrame: CapturedFrameWithBlob = {
          ...newFrame,
          blob: frame
        };
        
        // Add to captured frames
        setCapturedFrames(prev => [...prev, capturedFrame]);
        
        // Add to selected frames
        setSelectedFrames(prev => {
          const newFrames = [...prev, newFrame];
          // Sort frames by timestamp
          return newFrames.sort((a, b) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp));
        });
        
        // Add timemark to the seek bar
        setCapturedTimemarks(prev => [...prev, currentTimePosition]);
        
        toast.success(`Frame captured at ${timestamp}`, {
          id: 'capture-frame'
        });
      } else {
        // Create placeholder if extraction failed
        createPlaceholderFrame(currentTimePosition);
        
        toast.error(`Could not capture frame at ${timestamp}`, {
          id: 'capture-frame'
        });
      }
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast.error(`Failed to capture frame: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        id: 'capture-frame'
      });
    } finally {
      setIsCapturingFrame(false);
    }
  };
  
  // Create a placeholder frame when capture fails
  const createPlaceholderFrame = (timeInSeconds: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("Failed to create placeholder frame");
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error("Failed to create placeholder frame");
      return;
    }
    
    // Set canvas size if not already set
    canvas.width = 640;
    canvas.height = 360;
    
    // Format timestamp
    const timestamp = formatTime(timeInSeconds);
    
    // Draw placeholder
    ctx.fillStyle = "#2563eb"; // Blue background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text explanation
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Frame at ${timestamp}`, canvas.width / 2, canvas.height / 2 - 15);
    ctx.font = "18px Arial";
    ctx.fillText("Could not extract frame from video", canvas.width / 2, canvas.height / 2 + 20);
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        // Generate unique ID for the frame
        const frameId = `frame-${Date.now()}`;
        
        // Create a URL for the blob
        const imageUrl = URL.createObjectURL(blob);
        
        // Create a new extracted frame
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl,
          timestamp,
          isPlaceholder: true
        };
        
        // Create a captured frame with blob
        const capturedFrame: CapturedFrameWithBlob = {
          ...newFrame,
          blob
        };
        
        // Add to captured frames
        setCapturedFrames(prev => [...prev, capturedFrame]);
        
        // Add to selected frames
        setSelectedFrames(prev => {
          const newFrames = [...prev, newFrame];
          // Sort frames by timestamp
          return newFrames.sort((a, b) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp));
        });
        
        // Add timemark to the seek bar
        setCapturedTimemarks(prev => [...prev, timeInSeconds]);
        
        toast.info(`Placeholder frame created at ${timestamp}`);
      } else {
        toast.error("Failed to create placeholder frame");
      }
    }, "image/jpeg", 0.95);
  };
  
  // Remove a frame from selection
  const removeFrame = (frameId: string) => {
    // Find the frame to remove
    const frameToRemove = selectedFrames.find(frame => frame.id === frameId);
    if (frameToRemove) {
      // Remove from captured timemarks if it exists there
      if (frameToRemove.timestamp) {
        const timeInSeconds = timeToSeconds(frameToRemove.timestamp);
        setCapturedTimemarks(prev => prev.filter(time => Math.abs(time - timeInSeconds) > 0.5));
      }
    }
    
    setSelectedFrames(prev => prev.filter(frame => frame.id !== frameId));
  };
  
  // Apply selected frames to slide
  const handleApplyFrames = () => {
    // Sort frames by timestamp before applying
    const sortedFrames = [...selectedFrames].sort((a, b) => {
      return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
    });
    onFramesSelected(sortedFrames);
    onClose();
  };
  
  // Custom render for slider with captured frame markers
  const renderSliderWithMarkers = () => {
    return (
      <div className="relative w-full">
        <Slider 
          value={[seekingValue]} 
          min={0} 
          max={duration || 100}
          step={0.01}
          onValueChange={handleSeekChange}
          onValueCommit={handleSeekEnd}
          onPointerDown={handleSeekStart}
          className="z-10"
        />
        
        {/* Timemark indicators */}
        {capturedTimemarks.map((time, index) => (
          <div 
            key={index}
            className="absolute top-1/2 w-1 h-4 bg-green-500 rounded-full transform -translate-y-1/2 z-0"
            style={{ 
              left: `${(time / (duration || 100)) * 100}%`,
              marginLeft: -2 // Center the marker
            }}
            title={`Captured frame at ${formatTime(time)}`}
          />
        ))}
      </div>
    );
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
              playsInline
              preload="auto" // Force full preload
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
                  disabled={!isVideoLoaded || isCapturingFrame}
                >
                  {isCapturingFrame ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-1" />
                  )}
                  {isCapturingFrame ? 'Capturing...' : 'Capture Frame'}
                </Button>
              </div>
              
              {/* Video seek slider with markers */}
              <div className="px-1">
                {renderSliderWithMarkers()}
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
                        {frame.isPlaceholder && (
                          <Badge className="absolute bottom-1 left-1 bg-amber-500" variant="secondary">
                            Placeholder
                          </Badge>
                        )}
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
