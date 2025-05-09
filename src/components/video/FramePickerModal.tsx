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
import { formatDuration, timestampToSeconds } from "@/utils/formatUtils";
import { supabase } from "@/integrations/supabase/client";
import { uploadSlideImage } from "@/services/imageService";
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { useUIReset } from "@/context/UIResetContext";
import { TimestampSlider } from "./TimestampSlider";

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
  
  const handleTimeChange = (time: number) => {
    setCurrentTime(time);
    
    if (videoRef.current) {
      videoRef.current.currentTime = time;
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
      
      // Create the timestamp just once and reuse it
      const currentTimestamp = formatDuration(video.currentTime);
      
      // Add timestamp overlay for reference
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(10, 10, 300, 30);
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`Timestamp: ${currentTimestamp}`, 15, 30);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob from canvas"));
        }, 'image/jpeg', 0.95);
      });
      
      // Create a file from the blob - using the currentTimestamp we already defined
      const file = new File([blob], `frame-${currentTimestamp.replace(/:/g, "-")}.jpg`, { type: 'image/jpeg' });
      
      // Upload to storage
      const uploadResult = await uploadSlideImage(file);
      
      if (!uploadResult || !uploadResult.url) {
        throw new Error("Failed to upload frame image");
      }
      
      // Add to captured frames
      const newFrame: ExtractedFrame = {
        timestamp: currentTimestamp,
        imageUrl: uploadResult.url
      };
      
      setCapturedFrames(prev => {
        // Check if we already have a frame with this timestamp
        const exists = prev.some(frame => frame.timestamp === currentTimestamp);
        if (exists) {
          // Replace the existing frame
          return prev.map(frame => 
            frame.timestamp === currentTimestamp ? newFrame : frame
          );
        } else {
          // Add new frame
          return [...prev, newFrame];
        }
      });
      
      toast.success(`Frame at ${currentTimestamp} captured!`);
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

  // Fix: Implement fetchVideo function properly
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

  // Fix the timestamp handling in the UI
  return (
    <SafeDialog open={open} onOpenChange={() => handleClose()}>
      <SafeDialogContent className="max-w-4xl w-full h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manual Frame Selection</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
              <p>Loading video...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <div>
                <p className="text-lg font-semibold">Failed to load video</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={fetchVideo} variant="outline" className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            {/* Video player */}
            <div className="relative bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                src={videoUrl || ""}
                className="max-h-[50vh] max-w-full"
                preload="metadata"
                onLoadedData={handleVideoLoaded}
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            
            {/* Enhanced timestamp slider with validation */}
            {videoDuration > 0 && (
              <TimestampSlider
                timestamps={capturedFrames.map(frame => frame.timestamp)}
                videoDuration={videoDuration}
                currentTime={currentTime}
                onTimeChange={handleTimeChange}
                onTimestampClick={(timestamp) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = timestampToSeconds(timestamp);
                    setCurrentTime(timestampToSeconds(timestamp));
                  }
                }}
                className="px-4"
              />
            )}
            
            {/* Video controls */}
            <div className="flex items-center justify-center space-x-4 px-4">
              <Button
                variant="outline"
                size="icon"
                onClick={seekBack}
                title="Back 5 seconds"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={togglePlayPause}
                title={isPlaying ? "Pause" : "Play"}
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
                title="Forward 5 seconds"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              
              <Button
                onClick={captureFrame}
                disabled={isCaptureLoading}
                className="ml-4"
              >
                <Camera className="mr-2 h-4 w-4" />
                {isCaptureLoading ? "Capturing..." : "Capture Frame"}
              </Button>
            </div>
            
            <Separator />
            
            {/* Captured frames */}
            <div className="flex-1 overflow-y-auto p-2">
              <h3 className="text-md font-medium mb-2">
                Captured Frames ({capturedFrames.length})
              </h3>
              
              {capturedFrames.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No frames captured yet.</p>
                  <p className="text-sm">
                    Use the video controls to find the frames you want to capture.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {capturedFrames.map((frame) => (
                    <div
                      key={frame.timestamp}
                      className="relative border rounded-md overflow-hidden group"
                    >
                      <img
                        src={frame.imageUrl}
                        alt={`Frame at ${frame.timestamp}`}
                        className="w-full aspect-video object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteFrame(frame.timestamp)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1">
                        {frame.timestamp}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Action buttons */}
            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              
              <Button
                onClick={handleComplete}
                disabled={capturedFrames.length === 0}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Apply {capturedFrames.length} {capturedFrames.length === 1 ? "Frame" : "Frames"}
              </Button>
            </div>
          </div>
        )}
      </SafeDialogContent>
    </SafeDialog>
  );
};
