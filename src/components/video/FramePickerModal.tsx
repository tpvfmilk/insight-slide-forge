
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
import { Badge } from "@/components/ui/badge";

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
  
  // Improved captureFrame function with enhanced techniques to avoid black frames
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
      canvas.width = video.videoWidth || 1280; // Fallback if video width is not available
      canvas.height = video.videoHeight || 720; // Fallback if video height is not available
      
      // Create timestamp for the current position
      const currentTimestamp = formatDuration(video.currentTime);
      
      // Log dimensions for debugging
      console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
      console.log(`Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
      
      const captureWithRetries = async () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }
        
        // Function to check if a frame has content (not black)
        const hasContent = (imageData: ImageData): boolean => {
          let nonBlackPixels = 0;
          const totalPixels = imageData.width * imageData.height;
          const sampleSize = Math.min(totalPixels, 1000); // Sample up to 1000 pixels
          
          // Sample pixels throughout the image
          for (let i = 0; i < sampleSize; i++) {
            const pixelIndex = Math.floor(Math.random() * totalPixels) * 4;
            const r = imageData.data[pixelIndex];
            const g = imageData.data[pixelIndex + 1];
            const b = imageData.data[pixelIndex + 2];
            
            // Consider anything not very dark as content (more lenient threshold)
            if (r > 15 || g > 15 || b > 15) {
              nonBlackPixels++;
            }
          }
          
          // If at least 5% of sampled pixels have content, consider it valid
          return (nonBlackPixels / sampleSize) > 0.05;
        };
        
        // Function to draw frame and check content
        const drawAndCheck = (): boolean => {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Check a sample of pixels to see if we have content
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return hasContent(imageData);
        };
        
        // Initial frame capture attempt with longer preloading time
        console.log(`Attempting to capture frame at ${currentTimestamp} (${video.currentTime}s)...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for frame to fully load
        
        let hasValidContent = drawAndCheck();
        console.log(`First attempt result: ${hasValidContent ? 'Valid content' : 'Black/empty frame'}`);
        
        // If first attempt failed, try with multiple techniques
        if (!hasValidContent) {
          console.log("First attempt produced black frame, trying alternative methods...");
          
          // Try multiple techniques in sequence
          const techniques = [
            {
              name: "Seek forward and back",
              action: async () => {
                const originalTime = video.currentTime;
                // Seek forward slightly
                video.currentTime = originalTime + 0.5;
                await new Promise(resolve => setTimeout(resolve, 500));
                // Seek back to original position
                video.currentTime = originalTime;
                await new Promise(resolve => setTimeout(resolve, 500));
                return drawAndCheck();
              }
            },
            {
              name: "Try different offsets",
              action: async () => {
                const originalTime = video.currentTime;
                // Try different time offsets
                for (const offset of [0.1, 0.2, 0.3, -0.1, -0.2]) {
                  video.currentTime = originalTime + offset;
                  await new Promise(resolve => setTimeout(resolve, 500));
                  if (drawAndCheck()) return true;
                }
                // Reset to original time
                video.currentTime = originalTime;
                await new Promise(resolve => setTimeout(resolve, 500));
                return drawAndCheck();
              }
            },
            {
              name: "Play briefly and pause",
              action: async () => {
                const originalTime = video.currentTime;
                // Try playing for a moment
                try {
                  await video.play();
                  await new Promise(resolve => setTimeout(resolve, 200));
                  video.pause();
                } catch (err) {
                  console.log("Couldn't play video briefly:", err);
                }
                // Move back to original time
                video.currentTime = originalTime;
                await new Promise(resolve => setTimeout(resolve, 500));
                return drawAndCheck();
              }
            }
          ];
          
          // Try each technique until one works
          for (const technique of techniques) {
            console.log(`Trying technique: ${technique.name}`);
            hasValidContent = await technique.action();
            if (hasValidContent) {
              console.log(`Success with technique: ${technique.name}`);
              break;
            }
          }
        }
        
        // If we still couldn't get content, show an error
        if (!hasValidContent) {
          toast.error("Could not capture a valid frame. Please try again or try at a different timestamp.");
          setIsCaptureLoading(false);
          return false;
        }
        
        // Add timestamp overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(10, 10, 250, 30);
        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.textAlign = "left";
        ctx.fillText(`Timestamp: ${currentTimestamp}`, 15, 30);
        
        return true;
      };
      
      // Execute capture with retries
      const success = await captureWithRetries();
      if (!success) {
        return;
      }
      
      // Convert to blob with high quality
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob from canvas"));
        }, 'image/jpeg', 0.95); // High quality JPEG
      });
      
      // Create a file from the blob
      const file = new File([blob], `frame-${currentTimestamp.replace(/:/g, "-")}.jpg`, { type: 'image/jpeg' });
      
      // Upload to storage
      const uploadResult = await uploadSlideImage(file);
      
      if (!uploadResult || !uploadResult.url) {
        throw new Error("Failed to upload frame image");
      }
      
      // Add to captured frames
      const newFrame: ExtractedFrame = {
        timestamp: currentTimestamp,
        imageUrl: uploadResult.url,
        id: `frame-${currentTimestamp.replace(/:/g, "-")}`,
        isPlaceholder: false
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
  
  return (
    <SafeDialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
      className="w-full max-w-7xl"
    >
      <SafeDialogContent className="w-full max-w-7xl max-h-[95vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <DialogTitle>Frame Picker</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleClose}
                variant="outline"
                size="icon"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 h-[80vh] overflow-hidden">
          {/* Left side - Video player */}
          <div className="md:col-span-2 flex flex-col h-full overflow-hidden">
            <div className="relative bg-black aspect-video flex items-center justify-center flex-1 overflow-hidden">
              {isLoading ? (
                <div className="text-white flex flex-col items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin mb-2" />
                  <p>Loading video...</p>
                </div>
              ) : error ? (
                <div className="text-white flex flex-col items-center justify-center p-4 text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                  <p className="text-red-400 font-medium">Failed to load video</p>
                  <p className="text-sm text-gray-400 mt-1">{error}</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl || undefined}
                    className="w-full h-full"
                    controls={false}
                    onLoadedData={handleVideoLoaded}
                    crossOrigin="anonymous"
                  />
                  
                  {/* Canvas for frame extraction (hidden) */}
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                </>
              )}
              
              {/* Timestamp overlay */}
              {!isLoading && !error && (
                <div className="absolute bottom-4 left-4 bg-black/70 text-white px-2 py-1 rounded text-sm">
                  {formatDuration(currentTime)} / {formatDuration(videoDuration)}
                </div>
              )}
            </div>
            
            {/* Video controls */}
            <div className="flex flex-col space-y-4 py-4">
              <div className="px-4">
                {videoDuration > 0 && (
                  <Slider
                    value={[currentTime]}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    onValueChange={handleTimeChange}
                    disabled={isLoading || !!error}
                  />
                )}
              </div>
              
              <div className="flex justify-between px-4">
                <div className="flex space-x-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={seekBack}
                    disabled={isLoading || !!error}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={togglePlayPause}
                    disabled={isLoading || !!error}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={seekForward}
                    disabled={isLoading || !!error}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button
                  onClick={captureFrame}
                  disabled={isLoading || !!error || isCaptureLoading}
                >
                  {isCaptureLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Capturing...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Capture Frame
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Right side - Captured frames */}
          <div className="flex flex-col h-full overflow-hidden border rounded-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-medium">Captured Frames</h3>
              <Badge variant="outline">{capturedFrames.length}</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {capturedFrames.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
                  <Camera className="h-8 w-8 mb-2" />
                  <p>No frames captured yet</p>
                  <p className="text-xs mt-1">Use the capture button to extract frames from the video</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...capturedFrames]
                    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                    .map((frame) => (
                      <div
                        key={frame.id || frame.timestamp}
                        className="relative group border rounded-md overflow-hidden"
                      >
                        <img
                          src={frame.imageUrl}
                          alt={`Frame at ${frame.timestamp}`}
                          className="w-full h-auto aspect-video object-cover"
                        />
                        
                        <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-2 bg-black/70 text-white text-sm">
                          <span>{frame.timestamp}</span>
                          
                          <div className="flex items-center gap-1">
                            {frame.isPlaceholder && (
                              <Badge variant="outline" className="bg-amber-600/70 text-white border-none text-[10px] h-4 px-1">
                                Placeholder
                              </Badge>
                            )}
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-6 w-6"
                              onClick={() => deleteFrame(frame.timestamp)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-between">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              
              <Button
                onClick={handleComplete}
                size="sm"
                disabled={capturedFrames.length === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Apply Selected Frames
              </Button>
            </div>
          </div>
        </div>
      </SafeDialogContent>
    </SafeDialog>
  );
};
