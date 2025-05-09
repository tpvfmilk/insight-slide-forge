
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SafeDialog, SafeDialogContent } from "@/components/ui/safe-dialog";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { 
  Play, Pause, SkipBack, SkipForward, Camera, AlertCircle,
  RefreshCw, CheckCircle2, X, Trash2
} from "lucide-react";
import { formatDuration } from "@/utils/formatUtils";
import { supabase } from "@/integrations/supabase/client";
import { uploadSlideImage } from "@/services/imageService";
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { useUIReset } from "@/context/UIResetContext";

interface FramePickerModalProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  projectId: string;
  onComplete: (selectedFrames: ExtractedFrame[]) => void;
  videoMetadata?: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  };
  existingFrames?: ExtractedFrame[];
}

export const FramePickerModal = ({
  open,
  onClose,
  videoPath,
  projectId,
  onComplete,
  videoMetadata,
  existingFrames = [],
}: FramePickerModalProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [capturedFrames, setCapturedFrames] = useState<ExtractedFrame[]>(existingFrames || []);
  const [isCaptureLoading, setIsCaptureLoading] = useState<boolean>(false);
  const { registerUIElement, unregisterUIElement } = useUIReset();
  const elementId = useRef(`frame-picker-${Math.random().toString(36).substring(2, 9)}`);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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
    }
    
    return () => {
      unregisterUIElement(elementId.current);
    };
  }, [open, registerUIElement, unregisterUIElement]);
  
  // Load the video when the component mounts
  useEffect(() => {
    if (!open) return;
    
    const fetchVideo = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // First try with 'video_uploads' bucket
        try {
          const { data, error } = await supabase.storage
            .from("video_uploads")
            .createSignedUrl(videoPath, 3600); // 1 hour expiry
          
          if (error) throw error;
          
          if (!data || !data.signedUrl) {
            throw new Error("Failed to get video URL from video_uploads");
          }
          
          setVideoUrl(data.signedUrl);
          console.log("Successfully loaded video from video_uploads bucket");
          setIsLoading(false);
          return;
        } catch (videoUploadsError) {
          console.warn("Failed to get video from video_uploads bucket, trying 'videos' bucket...");
          
          // Try with 'videos' bucket as alternative
          try {
            // Extract just the filename from the path
            const filename = videoPath.split('/').pop();
            if (!filename) {
              throw new Error("Invalid video path format");
            }
            
            const { data, error } = await supabase.storage
              .from('videos')
              .createSignedUrl(filename, 3600);
            
            if (error || !data?.signedUrl) {
              throw new Error(`Error from videos bucket: ${error?.message}`);
            }
            
            setVideoUrl(data.signedUrl);
            console.log("Successfully loaded video from videos bucket");
            setIsLoading(false);
            return;
          } catch (videosBucketError) {
            console.error("Error creating signed URL for video:", { 
              videoUploadsError, 
              videosBucketError 
            });
            
            // Try to check if the video exists in the database but with a different path
            const { data: projectData, error: projectPathError } = await supabase
              .from('projects')
              .select('source_url')
              .eq('id', projectId)
              .maybeSingle();
              
            if (projectPathError) {
              console.error("Error fetching project source URL:", projectPathError);
            }
            
            // If we have a source URL in the project, try that instead
            if (projectData?.source_url) {
              console.log("Found source URL in project, trying that instead:", projectData.source_url);
              setVideoUrl(projectData.source_url);
              setIsLoading(false);
              return;
            }
            
            throw new Error("Failed to get video URL. Please check if the video file exists in storage.");
          }
        }
      } catch (err) {
        console.error("Error fetching video:", err);
        setError(err instanceof Error ? err.message : "Failed to load video");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVideo();
    
    // Initialize with existing frames if provided
    if (existingFrames && existingFrames.length > 0) {
      setCapturedFrames(existingFrames);
    }
  }, [open, videoPath, existingFrames, projectId]);
  
  // Update currentTime when the video plays
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
  }, [videoRef.current]);
  
  // Sync video play state with isPlaying
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.play().catch(err => {
        console.error("Error playing video:", err);
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
  }, [isPlaying]);
  
  const handleVideoLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // Attempt to play the video for a moment to ensure frames are loaded
    video.play().catch(err => {
      console.log("Video auto-play attempt failed (expected):", err);
    });
    
    setTimeout(() => {
      video.pause();
      // Use the video's duration or fall back to the metadata
      setVideoDuration(video.duration || videoMetadata?.duration || 0);
      console.log("Video ready. Dimensions:", video.videoWidth, "x", video.videoHeight, ", Duration:", video.duration + "s");
      
      // Verify any timestamps that exceed duration
      if (videoMetadata?.duration) {
        const exceededTimestamps = [];
        for (let i = 0; i < 10; i++) {
          // Check some common timestamps
          const minutes = String(i).padStart(2, '0');
          for (let j = 0; j < 60; j += 15) {
            const seconds = String(j).padStart(2, '0');
            const timestamp = `00:${minutes}:${seconds}`;
            if (formatDuration(video.duration) < timestamp) {
              exceededTimestamps.push(timestamp);
            }
          }
        }
        if (exceededTimestamps.length > 0) {
          console.warn("Found", exceededTimestamps.length, "timestamps that exceed video duration:", exceededTimestamps);
        }
      }
    }, 1000);
  };
  
  const handleTimeChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };
  
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const seekBack = () => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - 5);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };
  
  const seekForward = () => {
    if (videoRef.current && videoDuration) {
      const newTime = Math.min(videoDuration, videoRef.current.currentTime + 5);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };
  
  const captureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !projectId) {
      toast.error("Cannot capture frame: missing video or canvas");
      return;
    }
    
    setIsCaptureLoading(true);
    
    try {
      // Ensure video is paused for accurate capture
      if (!video.paused) {
        video.pause();
        setIsPlaying(false);
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current frame on the canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // Clear canvas before drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the current frame on the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Check if we got a black frame
      const imageData = ctx.getImageData(0, 0, 20, 20);
      let hasContent = false;
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i+1]; 
        const b = imageData.data[i+2];
        if (r > 15 || g > 15 || b > 15) {
          hasContent = true;
          break;
        }
      }
      
      if (!hasContent) {
        console.warn("Captured frame appears to be black, trying to fix...");
        
        // Add a visual indicator on black frames
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Frame may be black - try a different timestamp", canvas.width / 2, canvas.height / 2);
      }
      
      // Add timestamp overlay for reference
      const timestamp = formatDuration(video.currentTime);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(10, 10, 300, 30);
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`Timestamp: ${timestamp}`, 15, 30);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob from canvas"));
        }, 'image/jpeg', 0.95);
      });
      
      // Create a file from the blob
      const timestamp = formatDuration(video.currentTime);
      const file = new File([blob], `frame-${timestamp.replace(/:/g, "-")}.jpg`, { type: 'image/jpeg' });
      
      // Upload to storage
      const uploadResult = await uploadSlideImage(file);
      
      if (!uploadResult || !uploadResult.url) {
        throw new Error("Failed to upload frame image");
      }
      
      // Add to captured frames
      const newFrame: ExtractedFrame = {
        timestamp,
        imageUrl: uploadResult.url
      };
      
      setCapturedFrames(prev => {
        // Check if we already have a frame with this timestamp
        const exists = prev.some(frame => frame.timestamp === timestamp);
        if (exists) {
          // Replace the existing frame
          return prev.map(frame => 
            frame.timestamp === timestamp ? newFrame : frame
          );
        } else {
          // Add new frame
          return [...prev, newFrame];
        }
      });
      
      toast.success(`Frame at ${timestamp} captured!`);
    } catch (err) {
      console.error("Error capturing frame:", err);
      toast.error(`Failed to capture frame: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsCaptureLoading(false);
    }
  };
  
  const deleteFrame = (timestamp: string) => {
    setCapturedFrames(prev => prev.filter(frame => frame.timestamp !== timestamp));
    toast.success(`Removed frame at ${timestamp}`);
  };
  
  const handleComplete = () => {
    onComplete(capturedFrames);
    handleClose();
  };
  
  const handleClose = () => {
    // Clean up properly to prevent UI blockers
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.load();
    }
    
    onClose();
  };
  
  return (
    <SafeDialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SafeDialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select Video Frames</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-2 text-muted-foreground">Loading video...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 text-destructive">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Video player */}
            <div className="relative bg-black aspect-video">
              <video 
                ref={videoRef}
                src={videoUrl || undefined}
                className="w-full h-full"
                onLoadedMetadata={handleVideoLoaded}
                onLoadedData={handleVideoLoaded}
                controls={false}
                crossOrigin="anonymous"
              />
              
              {/* Hidden canvas for frame capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            
            {/* Video controls */}
            <div className="space-y-2">
              {/* Time display */}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(videoDuration)}</span>
              </div>
              
              {/* Scrubbing slider */}
              <Slider 
                value={[currentTime]}
                min={0}
                max={videoDuration || 100}
                step={0.01}
                onValueChange={handleTimeChange}
                className="w-full"
              />
              
              {/* Control buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={seekBack}
                    disabled={isLoading}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={togglePlayPause}
                    disabled={isLoading}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={seekForward}
                    disabled={isLoading}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button 
                  variant="default" 
                  onClick={captureFrame}
                  disabled={isLoading || isCaptureLoading}
                  className="gap-2"
                >
                  {isCaptureLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Capturing...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      Capture Frame
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Captured frames section */}
            <div>
              <h3 className="font-medium mb-2">Captured Frames ({capturedFrames.length})</h3>
              
              {capturedFrames.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No frames captured yet.</p>
                  <p className="text-sm mt-1">Use the video controls above and click "Capture Frame" to extract images.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {capturedFrames.map((frame) => (
                    <div key={frame.timestamp} className="relative border rounded-md overflow-hidden bg-muted/20">
                      <img 
                        src={frame.imageUrl} 
                        alt={`Frame at ${frame.timestamp}`} 
                        className="w-full aspect-video object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm p-2 flex justify-between items-center">
                        <span className="text-xs font-mono">{frame.timestamp}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteFrame(frame.timestamp)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                <X className="h-4 w-4 mr-2" /> 
                Cancel
              </Button>
              <Button onClick={handleComplete} disabled={capturedFrames.length === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Use Selected Frames
              </Button>
            </div>
          </div>
        )}
      </SafeDialogContent>
    </SafeDialog>
  );
};
