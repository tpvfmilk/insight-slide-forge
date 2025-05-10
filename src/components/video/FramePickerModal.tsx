import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SafeDialog, SafeDialogContent } from "@/components/ui/safe-dialog";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { 
  Play, Pause, SkipBack, SkipForward, Camera, AlertCircle,
  RefreshCw, CheckCircle2, X, Trash2, Film, Check, Square, CheckSquare
} from "lucide-react";
import { formatDuration } from "@/utils/formatUtils";
import { supabase } from "@/integrations/supabase/client";
import { uploadSlideImage } from "@/services/imageService";
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { useUIReset } from "@/context/UIResetContext";
import { Badge } from "@/components/ui/badge";
import { fetchProjectVideos, ProjectVideo } from "@/services/projectVideoService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [selectedFrames, setSelectedFrames] = useState<Record<string, boolean>>({});
  const [isCaptureLoading, setIsCaptureLoading] = useState<boolean>(false);
  const [projectVideos, setProjectVideos] = useState<ProjectVideo[]>([]);
  const [selectedVideoPath, setSelectedVideoPath] = useState<string>(videoPath);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(false);
  const [frameLibrary, setFrameLibrary] = useState<ExtractedFrame[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(false);
  
  const { registerUIElement, unregisterUIElement } = useUIReset();
  const elementId = useRef(`frame-picker-${Math.random().toString(36).substring(2, 9)}`);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Load project videos
  useEffect(() => {
    if (open && projectId) {
      setIsLoadingVideos(true);
      
      fetchProjectVideos(projectId)
        .then(videos => {
          console.log("Fetched project videos:", videos);
          setProjectVideos(videos || []);
          
          // Add the main project video if it's not already in the list
          // This ensures the original uploaded video is included
          if (videoPath && !videos.some(v => v.source_file_path === videoPath)) {
            // We'll handle this after loading the current video
            console.log("Main project video is not in project_videos table:", videoPath);
          }
        })
        .catch(err => {
          console.error("Error fetching project videos:", err);
          toast.error("Failed to load project videos");
        })
        .finally(() => {
          setIsLoadingVideos(false);
        });
      
      // Load frame library - all existing frames for this project
      loadFrameLibrary();
    }
  }, [open, projectId, videoPath]);
  
  // Load frame library - all existing extracted frames for the project
  const loadFrameLibrary = async () => {
    if (!projectId) return;
    
    setIsLoadingLibrary(true);
    try {
      // Fetch the project to get all extracted frames
      const { data: project, error } = await supabase
        .from('projects')
        .select('extracted_frames')
        .eq('id', projectId)
        .single();
        
      if (error) {
        console.error("Error fetching project frames:", error);
        return;
      }
      
      // Also fetch frames from all project videos
      const projectVideos = await fetchProjectVideos(projectId);
      const allFrames: ExtractedFrame[] = [];
      
      // Add frames from the main project
      if (project?.extracted_frames && Array.isArray(project.extracted_frames)) {
        allFrames.push(...(project.extracted_frames as ExtractedFrame[]));
      }
      
      // Add frames from all videos
      projectVideos.forEach(video => {
        if (video.extracted_frames && Array.isArray(video.extracted_frames)) {
          allFrames.push(...(video.extracted_frames as ExtractedFrame[]));
        }
      });
      
      // Filter out duplicates based on imageUrl
      const uniqueFrames = allFrames.filter((frame, index, self) =>
        index === self.findIndex((f) => f.imageUrl === frame.imageUrl)
      );
      
      console.log(`Loaded ${uniqueFrames.length} frames for frame library`);
      setFrameLibrary(uniqueFrames);
      
      // Initialize selected frames from existing frames passed to the component
      if (existingFrames && existingFrames.length > 0) {
        const selected: Record<string, boolean> = {};
        existingFrames.forEach(frame => {
          const key = frame.id || frame.timestamp;
          selected[key] = true;
        });
        setSelectedFrames(selected);
      }
    } catch (error) {
      console.error("Error loading frame library:", error);
    } finally {
      setIsLoadingLibrary(false);
    }
  };
  
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
  
  // Load the video when the component mounts or when the selected video changes
  useEffect(() => {
    if (!open || !selectedVideoPath) return;
    
    const fetchVideo = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // First try with 'video_uploads' bucket
        try {
          const { data, error } = await supabase.storage
            .from("video_uploads")
            .createSignedUrl(selectedVideoPath, 3600); // 1 hour expiry
          
          if (error) throw error;
          
          if (!data || !data.signedUrl) {
            throw new Error("Failed to get video URL from video_uploads");
          }
          
          setVideoUrl(data.signedUrl);
          console.log("Successfully loaded video from video_uploads bucket");
          setIsLoading(false);
          return;
        } catch (videoUploadsError) {
          console.warn("Failed to get video from video_uploads bucket, trying 'videos' bucket...", videoUploadsError);
          
          // Try with 'videos' bucket as alternative
          try {
            // Extract just the filename from the path
            const filename = selectedVideoPath.split('/').pop();
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
    
    // Reset selection state when the modal opens
    setSelectedFrames({});
    
    // Initialize with existing frames if provided
    if (existingFrames && existingFrames.length > 0) {
      const selected: Record<string, boolean> = {};
      existingFrames.forEach(frame => {
        const key = frame.id || frame.timestamp;
        selected[key] = true;
      });
      setSelectedFrames(selected);
      setCapturedFrames(existingFrames);
    }
  }, [open, selectedVideoPath, projectId, existingFrames]);
  
  // Function to handle video selection change
  const handleVideoChange = (value: string) => {
    setSelectedVideoPath(value);
    
    // Reset player state
    setCurrentTime(0);
    setIsPlaying(false);
    setVideoDuration(0);
    setVideoUrl(null);
    
    console.log("Selected video changed to:", value);
  };
  
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
  
  // Modified to prevent auto-play on load
  const handleVideoLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // Set to auto but don't auto-play
    video.preload = "auto";
    
    // No longer automatically playing the video
    video.pause();
    setIsPlaying(false);
    
    // Use the video's duration or fall back to the metadata
    setVideoDuration(video.duration || videoMetadata?.duration || 0);
    console.log("Video ready. Dimensions:", video.videoWidth, "x", video.videoHeight, ", Duration:", video.duration + "s");
    
    // Pre-seek to multiple positions to help load frames throughout the video
    // This helps prevent black frames when capturing later, without playing
    preloadVideoFrames(video);
  };
  
  // Function to preload video frames by seeking to multiple positions
  const preloadVideoFrames = async (video: HTMLVideoElement) => {
    const duration = video.duration;
    if (!duration) return;
    
    // Store the original position to restore later
    const originalTime = video.currentTime;
    
    // Seek to a few key positions and wait briefly to load those frames
    const positions = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration - 1];
    console.log("Preloading frames at positions:", positions.map(p => formatDuration(p)));
    
    for (const position of positions) {
      video.currentTime = position;
      // Wait a moment for the frame to load
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Return to original position
    video.currentTime = originalTime;
    console.log("Video frame preloading complete");
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
  
  // Toggle frame selection
  const toggleFrameSelection = (frame: ExtractedFrame) => {
    const key = frame.id || frame.timestamp;
    setSelectedFrames(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  // Improved capture frame function with better preloading and retries
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
      
      // Enhanced capture function with improved preloading
      const enhancedCapture = async (): Promise<boolean> => {
        // First, prepare the video to ensure the frame is properly loaded
        // This is the key improvement to fix the first-time capture issue
        const currentTime = video.currentTime;
        
        // Pre-seek approach: move slightly away and back to force frame loading
        // Seek a bit behind current position if possible
        const seekBackTime = Math.max(0, currentTime - 0.5);
        video.currentTime = seekBackTime;
        
        // Wait for seeking to complete
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });
        
        // Now seek back to desired position
        video.currentTime = currentTime;
        
        // Wait for seeking to complete again
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });
        
        // Give extra time for the frame to fully render
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get the canvas context
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Check if the frame has content
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Function to check if image has content (not black/empty)
        const hasValidContent = (): boolean => {
          // Sample more pixels for better detection
          const samples = 1000;
          let nonBlackPixels = 0;
          
          for (let i = 0; i < samples; i++) {
            // Get random pixel positions throughout the image
            const x = Math.floor(Math.random() * canvas.width);
            const y = Math.floor(Math.random() * canvas.height);
            
            // Get pixel data at this position
            const pixelIndex = (y * canvas.width + x) * 4;
            const r = imageData.data[pixelIndex];
            const g = imageData.data[pixelIndex + 1];
            const b = imageData.data[pixelIndex + 2];
            
            // More permissive threshold to detect content
            if (r > 10 || g > 10 || b > 10) {
              nonBlackPixels++;
            }
          }
          
          // Consider frame valid if at least 5% of sampled pixels have content
          const percentWithContent = (nonBlackPixels / samples) * 100;
          console.log(`Frame analysis: ${percentWithContent.toFixed(2)}% of pixels have content`);
          return percentWithContent >= 5;
        };
        
        // If we have valid content, add timestamp and return success
        if (hasValidContent()) {
          // Add timestamp overlay
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.fillRect(10, 10, 250, 30);
          ctx.fillStyle = "white";
          ctx.font = "16px Arial";
          ctx.textAlign = "left";
          ctx.fillText(`Timestamp: ${currentTimestamp}`, 15, 30);
          return true;
        }
        
        return false;
      };
      
      // Try the enhanced capture approach with multiple attempts
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!success && attempts < maxAttempts) {
        attempts++;
        console.log(`Capture attempt ${attempts}/${maxAttempts}`);
        success = await enhancedCapture();
        
        if (success) {
          console.log(`Successful capture on attempt ${attempts}`);
          break;
        } else if (attempts < maxAttempts) {
          console.log(`Attempt ${attempts} failed, trying again with different technique`);
          // Try different techniques on subsequent attempts
          switch (attempts) {
            case 1:
              // Seek forward slightly for second attempt
              if (video.currentTime + 0.2 < video.duration) {
                video.currentTime += 0.2;
                await new Promise(resolve => setTimeout(resolve, 300));
              }
              break;
            case 2:
              // Try with brief play/pause for third attempt
              try {
                await video.play();
                await new Promise(resolve => setTimeout(resolve, 200));
                video.pause();
                await new Promise(resolve => setTimeout(resolve, 300));
              } catch (e) {
                console.log("Could not play video briefly:", e);
              }
              break;
          }
        }
      }
      
      if (!success) {
        toast.error("Could not capture a valid frame. Please try again or try at a different timestamp.");
        setIsCaptureLoading(false);
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
      
      // Automatically select the newly captured frame
      setSelectedFrames(prev => ({
        ...prev,
        [newFrame.id]: true
      }));
      
      toast.success(`Frame at ${currentTimestamp} captured!`);
    } catch (err) {
      console.error("Error capturing frame:", err);
      toast.error(`Failed to capture frame: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsCaptureLoading(false);
    }
  };
  
  const deleteFrame = (timestamp: string) => {
    // Remove from captured frames
    setCapturedFrames(prev => prev.filter(frame => frame.timestamp !== timestamp));
    
    // Also remove from selected frames
    const framesToRemove = capturedFrames.filter(frame => frame.timestamp === timestamp);
    framesToRemove.forEach(frame => {
      const key = frame.id || frame.timestamp;
      setSelectedFrames(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    });
    
    toast.success(`Removed frame at ${timestamp}`);
  };
  
  // Return only selected frames when completing
  const handleComplete = () => {
    const frames = [...capturedFrames, ...frameLibrary].filter(frame => {
      const key = frame.id || frame.timestamp;
      return selectedFrames[key] === true;
    });
    
    if (frames.length === 0) {
      toast.warning("No frames selected. Please select at least one frame.");
      return;
    }
    
    onComplete(frames);
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
  
  // Get a display name for the video
  const getVideoDisplayName = (path: string) => {
    // First try to match with project videos
    const matchedVideo = projectVideos.find(v => v.source_file_path === path);
    if (matchedVideo && matchedVideo.title) {
      return matchedVideo.title;
    }
    
    // Otherwise extract from path
    const pathParts = path.split('/');
    return pathParts[pathParts.length - 1];
  };
  
  // Get the count of selected frames
  const getSelectedFramesCount = () => {
    return Object.values(selectedFrames).filter(Boolean).length;
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
            <Badge variant="outline">{getSelectedFramesCount()} selected</Badge>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 h-[80vh] overflow-hidden">
          {/* Left side - Video player */}
          <div className="md:col-span-2 flex flex-col h-full overflow-hidden">
            {/* Video selector */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Select Video</label>
              <div className="flex gap-2">
                <Select 
                  value={selectedVideoPath}
                  onValueChange={handleVideoChange}
                  disabled={isLoadingVideos}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue>
                      {isLoadingVideos ? (
                        <span className="flex items-center">
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Loading videos...
                        </span>
                      ) : (
                        getVideoDisplayName(selectedVideoPath)
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add the main project video if it's not already in the list */}
                    {videoPath && !projectVideos.some(v => v.source_file_path === videoPath) && (
                      <SelectItem value={videoPath}>
                        <div className="flex items-center">
                          <Film className="h-4 w-4 mr-2" />
                          {getVideoDisplayName(videoPath)} (Main video)
                        </div>
                      </SelectItem>
                    )}
                    
                    {/* List all project videos */}
                    {projectVideos.map((video) => (
                      <SelectItem key={video.id} value={video.source_file_path || ''}>
                        <div className="flex items-center">
                          <Film className="h-4 w-4 mr-2" />
                          {video.title || 'Untitled Video'}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
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
          
          {/* Right side - Frame library */}
          <div className="flex flex-col h-full overflow-hidden border rounded-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-medium">Frame Library</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{capturedFrames.length} captured</Badge>
                <Badge variant="outline" className="bg-primary text-white">
                  {getSelectedFramesCount()} selected
                </Badge>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {capturedFrames.length === 0 && frameLibrary.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
                  <Camera className="h-8 w-8 mb-2" />
                  <p>No frames available</p>
                  <p className="text-xs mt-1">Use the capture button to extract frames from the video</p>
                </div>
              ) : isLoadingLibrary ? (
                <div className="flex justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Newly captured frames section */}
                  {capturedFrames.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 px-1">Newly Captured</h4>
                      <div className="space-y-2">
                        {capturedFrames
                          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                          .map((frame) => {
                            const frameKey = frame.id || frame.timestamp;
                            const isSelected = selectedFrames[frameKey] === true;
                            
                            return (
                              <div
                                key={frameKey}
                                className={`relative group border rounded-md overflow-hidden cursor-pointer ${
                                  isSelected ? "ring-2 ring-primary" : ""
                                }`}
                                onClick={() => toggleFrameSelection(frame)}
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
                                    
                                    {isSelected ? (
                                      <CheckSquare className="h-5 w-5 text-primary bg-white/20 rounded" />
                                    ) : (
                                      <Square className="h-5 w-5 text-white/70" />
                                    )}
                                    
                                    <Button
                                      size="icon"
                                      variant="destructive"
                                      className="h-6 w-6 ml-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteFrame(frame.timestamp);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  
                  {/* Frame library section */}
                  {frameLibrary.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 px-1">Project Library</h4>
                      <div className="space-y-2">
                        {frameLibrary
                          .filter(frame => 
                            // Don't show frames that are already in the captured frames list
                            !capturedFrames.some(captured => captured.imageUrl === frame.imageUrl)
                          )
                          .sort((a, b) => a.timestamp?.localeCompare(b.timestamp || '') || 0)
                          .map((frame) => {
                            const frameKey = frame.id || frame.timestamp;
                            const isSelected = selectedFrames[frameKey] === true;
                            
                            return (
                              <div
                                key={frameKey}
                                className={`relative group border rounded-md overflow-hidden cursor-pointer ${
                                  isSelected ? "ring-2 ring-primary" : ""
                                }`}
                                onClick={() => toggleFrameSelection(frame)}
                              >
                                <img
                                  src={frame.imageUrl}
                                  alt={`Frame at ${frame.timestamp}`}
                                  className="w-full h-auto aspect-video object-cover"
                                />
                                
                                <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-2 bg-black/70 text-white text-sm">
                                  <span>{frame.timestamp}</span>
                                  
                                  <div className="flex items-center gap-1">
                                    {isSelected ? (
                                      <CheckSquare className="h-5 w-5 text-primary bg-white/20 rounded" />
                                    ) : (
                                      <Square className="h-5 w-5 text-white/70" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
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
                disabled={getSelectedFramesCount() === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Apply Selected Frames ({getSelectedFramesCount()})
              </Button>
            </div>
          </div>
        </div>
      </SafeDialogContent>
    </SafeDialog>
  );
};
