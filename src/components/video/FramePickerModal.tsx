
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export const FramePickerModal: React.FC<FramePickerModalProps> = ({
  open,
  onClose,
  videoPath,
  projectId,
  onComplete,
  videoMetadata,
  existingFrames = [],
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [capturedFrames, setCapturedFrames] = useState<ExtractedFrame[]>(existingFrames || []);
  const [isCaptureLoading, setIsCaptureLoading] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Ensure stable references to callback functions
  const closeModal = useCallback(() => {
    console.log("Modal close callback triggered");
    
    // Pause video if playing
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    
    // Reset state
    setIsPlaying(false);
    setVideoUrl(null);
    
    // Call parent close handler
    onClose();
  }, [onClose]);
  
  // Log when modal opens/closes
  useEffect(() => {
    console.log("FramePickerModal open state changed:", open);
    
    if (open) {
      console.log("FramePickerModal opened with props:", {
        videoPath,
        projectId,
        hasExistingFrames: existingFrames?.length > 0,
        videoMetadata,
      });
    }
  }, [open, existingFrames, projectId, videoMetadata, videoPath]);
  
  // Load the video when the component mounts or when open changes
  useEffect(() => {
    if (!open) return;
    
    console.log("FramePickerModal is open, loading video");
    
    const fetchVideo = async () => {
      setIsLoading(true);
      setError(null);
      setIsVideoReady(false);
      
      try {
        console.log("Fetching video from path:", videoPath);
        
        // Add cache busting parameter to prevent caching issues
        const timestamp = Date.now();
        
        // First try with 'video_uploads' bucket
        try {
          const { data, error } = await supabase.storage
            .from("video_uploads")
            .createSignedUrl(videoPath, 3600, {
              transform: {
                width: 1280, // Set a reasonable max width
              },
            });
          
          if (error) throw error;
          
          if (!data || !data.signedUrl) {
            throw new Error("Failed to get video URL from video_uploads");
          }
          
          // Add cache busting parameter
          const url = new URL(data.signedUrl);
          url.searchParams.append('_cb', timestamp.toString());
          
          setVideoUrl(url.toString());
          console.log("Successfully loaded video URL:", url.toString());
          
          // Wait a moment before considering loading complete
          setTimeout(() => {
            setIsLoading(false);
          }, 500);
          return;
        } catch (videoUploadsError) {
          console.warn("Failed to get video from video_uploads bucket, trying 'videos' bucket...", videoUploadsError);
          
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
            
            // Add cache busting parameter
            const url = new URL(data.signedUrl);
            url.searchParams.append('_cb', timestamp.toString());
            
            setVideoUrl(url.toString());
            console.log("Successfully loaded video from videos bucket:", url.toString());
            
            // Wait a moment before considering loading complete
            setTimeout(() => {
              setIsLoading(false);
            }, 500);
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
              
              // Add cache busting parameter
              const url = new URL(projectData.source_url);
              url.searchParams.append('_cb', timestamp.toString());
              
              setVideoUrl(url.toString());
              console.log("Using project source URL:", url.toString());
              
              // Wait a moment before considering loading complete
              setTimeout(() => {
                setIsLoading(false);
              }, 500);
              return;
            }
            
            throw new Error("Failed to get video URL. Please check if the video file exists in storage.");
          }
        }
      } catch (err) {
        console.error("Error fetching video:", err);
        setError(err instanceof Error ? err.message : "Failed to load video");
        setIsLoading(false);
      }
    };
    
    fetchVideo();
    
    // Initialize with existing frames if provided
    if (existingFrames && existingFrames.length > 0) {
      console.log("Initializing with existing frames:", existingFrames.length);
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
  }, []);
  
  // Sync video play state with isPlaying
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.play().catch(err => {
        console.error("Error playing video:", err);
        setIsPlaying(false);
        toast.error("Could not play video. Try clicking the video first.");
      });
    } else {
      video.pause();
    }
  }, [isPlaying]);
  
  // Enhanced video loading event handlers with better debugging
  const handleVideoEvents = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleCanPlay = () => {
      console.log("Video can play now:", {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        duration: video.duration,
        readyState: video.readyState,
        networkState: video.networkState
      });
      
      // Use the video's duration or fall back to the metadata
      setVideoDuration(video.duration || videoMetadata?.duration || 0);
      setIsVideoReady(true);
      
      // Manually set poster frame by seeking to the first frame
      if (video.duration > 0) {
        video.currentTime = 0.1;
      }
      
      // Log for debugging
      toast.success("Video loaded successfully");
    };
    
    const handleLoadedData = () => {
      console.log("Video data loaded with dimensions:", video.videoWidth, "x", video.videoHeight);
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn("Video dimensions are zero, possible CORS issue");
        toast.warning("Video dimensions could not be determined, frames may not capture correctly");
      }
    };
    
    const handleLoadedMetadata = () => {
      console.log("Video metadata loaded:", {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
    };
    
    const handleError = () => {
      const errorDetails = video.error 
        ? `Code: ${video.error.code}, Message: ${video.error.message || "Unknown"}` 
        : "Unknown error";
      console.error("Video loading error:", errorDetails);
      setError(`Video loading error: ${errorDetails}`);
    };
    
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [videoMetadata]);
  
  // Set up video event handlers
  useEffect(() => {
    const cleanup = handleVideoEvents();
    return cleanup;
  }, [handleVideoEvents]);
  
  const handleTimeChange = useCallback((value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, []);
  
  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);
  
  const seekBack = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - 5);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);
  
  const seekForward = useCallback(() => {
    if (videoRef.current && videoDuration) {
      const newTime = Math.min(videoDuration, videoRef.current.currentTime + 5);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [videoDuration]);
  
  // Enhanced frame capture with better error handling
  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !projectId) {
      toast.error("Cannot capture frame: missing video or canvas");
      return;
    }
    
    if (!isVideoReady) {
      toast.error("Video is not ready yet. Please wait for it to load completely.");
      return;
    }
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Cannot capture frame: video dimensions are invalid");
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
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // First clear the canvas to avoid ghost images
      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      console.log("Capturing frame at time:", video.currentTime, "with dimensions:", canvas.width, "x", canvas.height);
      
      // Draw the video frame and check for errors
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Check if the canvas is empty/black (possible CORS issue)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixelData = imageData.data;
        
        // Check if there are non-black pixels
        const hasContent = Array.from(pixelData).some(
          (value, index) => index % 4 !== 3 && value > 10
        );
        
        if (!hasContent) {
          console.warn("Canvas appears to be empty/black, possible CORS issue");
          toast.warning("Frame may appear blank due to video security restrictions. Try a different video source if available.");
        }
      } catch (drawError) {
        console.error("Error drawing video to canvas:", drawError);
        throw new Error(`Canvas drawing failed: ${drawError instanceof Error ? drawError.message : 'Unknown error'}. Possible CORS issue.`);
      }
      
      // Convert to blob with better error handling
      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob from canvas"));
          }, 'image/jpeg', 0.92);
        } catch (canvasError) {
          reject(new Error(`Canvas toBlob failed: ${canvasError instanceof Error ? canvasError.message : 'Unknown error'}`));
        }
      });
      
      // Create a file from the blob
      const timestamp = formatDuration(video.currentTime);
      const filename = `frame-${timestamp.replace(/:/g, "-")}-${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      
      console.log("Created file from blob:", {
        filename,
        size: blob.size,
        type: blob.type
      });
      
      // Upload to storage
      const uploadResult = await uploadSlideImage(file);
      
      if (!uploadResult || !uploadResult.url) {
        throw new Error("Failed to upload frame image");
      }
      
      console.log("Successfully uploaded image:", uploadResult.url);
      
      // Generate a unique ID for the frame
      const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add to captured frames
      const newFrame: ExtractedFrame = {
        id: frameId,
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
  }, [isVideoReady, projectId]);
  
  const deleteFrame = useCallback((timestamp: string) => {
    setCapturedFrames(prev => prev.filter(frame => frame.timestamp !== timestamp));
    toast.success(`Removed frame at ${timestamp}`);
  }, []);
  
  const handleComplete = useCallback(() => {
    if (capturedFrames.length === 0) {
      toast.warning("No frames selected. Please capture at least one frame.");
      return;
    }
    onComplete(capturedFrames);
  }, [capturedFrames, onComplete]);
  
  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        console.log("Dialog onOpenChange triggered with isOpen:", isOpen);
        if (!isOpen) {
          closeModal();
        }
      }}
    >
      <DialogContent className="max-w-4xl">
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
            <Button 
              variant="outline" 
              onClick={closeModal} 
              className="mt-4"
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Video player */}
            <div className="relative bg-black aspect-video">
              <video 
                ref={videoRef}
                src={videoUrl || undefined}
                className="w-full h-full"
                onLoadedMetadata={() => console.log("Video metadata loaded")}
                onCanPlay={() => console.log("Video can play event fired")}
                onClick={() => {
                  // Allow user to click on video to restart playback if it fails
                  if (!isPlaying) togglePlayPause();
                }}
                controls={false}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
              />
              
              {/* Hidden canvas for frame capture */}
              <canvas ref={canvasRef} className="hidden" />
              
              {!isVideoReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Loading video...</p>
                  </div>
                </div>
              )}
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
                disabled={!isVideoReady}
              />
              
              {/* Control buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={seekBack}
                    disabled={isLoading || !isVideoReady}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={togglePlayPause}
                    disabled={isLoading || !isVideoReady}
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
                    disabled={isLoading || !isVideoReady}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button 
                  variant="default" 
                  onClick={captureFrame}
                  disabled={isLoading || isCaptureLoading || !isVideoReady}
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
                    <div key={frame.id || frame.timestamp} className="relative border rounded-md overflow-hidden bg-muted/20">
                      <img 
                        src={frame.imageUrl} 
                        alt={`Frame at ${frame.timestamp}`} 
                        className="w-full aspect-video object-cover"
                        onError={(e) => {
                          console.error("Error loading frame image:", frame.imageUrl);
                          // Set a placeholder for broken images
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E";
                          (e.target as HTMLImageElement).classList.add("p-8", "opacity-30");
                        }}
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
              <Button variant="outline" onClick={closeModal}>
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
      </DialogContent>
    </Dialog>
  );
};
