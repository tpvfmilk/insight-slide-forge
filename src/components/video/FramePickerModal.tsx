import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Camera, Trash2, Plus, RefreshCw, AlertCircle, Rewind, FastForward, Check } from "lucide-react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";
import { Separator } from "@/components/ui/separator";
import { mergeAndSaveFrames } from "@/utils/frameUtils";

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
  const [selectedFrames, setSelectedFrames] = useState<{[key: string]: boolean}>({});
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
  const [libraryFrames, setLibraryFrames] = useState<ExtractedFrame[]>([]);
  const [isUploadingFrames, setIsUploadingFrames] = useState(false);
  
  // Reset state when opening modal
  useEffect(() => {
    if (open) {
      // Initialize with existing frames selected
      const initialSelectedState: {[key: string]: boolean} = {};
      
      // Select all existing frames by default
      if (existingFrames && existingFrames.length > 0) {
        existingFrames.forEach(frame => {
          if (frame.id) {
            initialSelectedState[frame.id] = true;
          }
        });
      }
      
      setSelectedFrames(initialSelectedState);
      setVideoError(null);
      setIsVideoLoaded(false);
      setIsLoadingVideo(true);
      setLoadAttempts(0);
      setCurrentTime(0);
      setSeekingValue(0);
      setCapturedFrames([]);
      setCapturedTimemarks([]);
      setIsCapturingFrame(false);
      
      // Load all project frames from allExtractedFrames
      if (allExtractedFrames && allExtractedFrames.length > 0) {
        console.log(`Loading ${allExtractedFrames.length} frames from project's extracted frames`);
        
        // Filter out any frames without valid URLs
        const validFrames = allExtractedFrames.filter(frame => 
          frame && frame.imageUrl && !frame.imageUrl.startsWith('blob:')
        );
        
        if (validFrames.length !== allExtractedFrames.length) {
          console.warn(`Filtered out ${allExtractedFrames.length - validFrames.length} frames with invalid URLs`);
        }
        
        // Sort frames by timestamp
        const sortedLibraryFrames = [...validFrames].sort((a, b) => {
          return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
        });
        
        // Add existing timemarks to seek bar
        const timemarks = sortedLibraryFrames.map(frame => timeToSeconds(frame.timestamp));
        setCapturedTimemarks(timemarks);
        
        setLibraryFrames(sortedLibraryFrames);
      } else {
        console.log('No existing frames found in project');
        setLibraryFrames([]);
      }
      
      // Try to load the video
      loadVideo();
    }
  }, [open, existingFrames, allExtractedFrames]);
  
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
  
  // Helper function to upload a captured frame to Supabase storage
  const uploadFrameToStorage = async (frame: Blob, timestamp: string): Promise<string | null> => {
    try {
      if (!projectId) {
        throw new Error("Project ID is required to upload frames");
      }
      
      // Create a File from the Blob
      const fileName = `frame-${timestamp.replace(/:/g, "-")}-${Date.now()}.jpg`;
      const file = new File([frame], fileName, {
        type: 'image/jpeg'
      });
      
      // Upload to Supabase Storage - ensure proper path and bucket
      const filePath = `${projectId}/${timestamp.replace(/:/g, '_')}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('slide_stills')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (uploadError || !uploadData?.path) {
        console.error("Error uploading frame:", uploadError);
        return null;
      }
      
      // Get public URL - CRUCIAL for persistence
      const { data: urlData } = supabase
        .storage
        .from('slide_stills')
        .getPublicUrl(uploadData.path);
        
      console.log(`Frame uploaded successfully, got permanent URL: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error("Error in uploadFrameToStorage:", error);
      return null;
    }
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
      
      const toastId = "capture-frame";
      toast.loading(`Capturing frame at ${timestamp}...`, { id: toastId });
      
      // Use our advanced frame extraction to get a good quality frame
      const extractedFrames = await extractFramesFromVideoUrl(
        videoUrl, 
        [timestamp],
        undefined,
        duration,
        {
          captureAttempts: 5, // More attempts
          captureOffsets: [-0.1, 0, 0.1, 0.2, -0.2, 0.5, -0.5, 0.8, -0.8], // More offsets
          minContentThreshold: 0.02 // Slightly lower threshold
        }
      );
      
      if (extractedFrames && extractedFrames.length > 0) {
        const { frame, timestamp: extractedTimestamp } = extractedFrames[0];
        
        // Upload the frame to storage to get a permanent URL
        const permanentUrl = await uploadFrameToStorage(frame, extractedTimestamp);
        
        if (!permanentUrl) {
          toast.error(`Failed to upload frame at ${timestamp}`, { id: toastId });
          createPlaceholderFrame(currentTimePosition);
          return;
        }
        
        // Create a new extracted frame with permanent URL
        const frameId = `frame-${Date.now()}-${extractedTimestamp}`;
        
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl: permanentUrl, // Use permanent URL from storage
          timestamp: extractedTimestamp,
          isPlaceholder: false
        };
        
        // Create a captured frame with blob (for local use only)
        const capturedFrame: CapturedFrameWithBlob = {
          ...newFrame,
          blob: frame
        };
        
        // Add to captured frames
        setCapturedFrames(prev => [...prev, capturedFrame]);
        
        // Add to library frames
        setLibraryFrames(prev => {
          const newFrames = [...prev, newFrame];
          // Sort frames by timestamp
          return newFrames.sort((a, b) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp));
        });
        
        // Automatically select the newly captured frame
        setSelectedFrames(prev => ({
          ...prev,
          [frameId]: true
        }));
        
        // Add timemark to the seek bar
        setCapturedTimemarks(prev => [...prev, currentTimePosition]);
        
        // Most importantly: Save the new frame to the project's frame library immediately
        // This ensures it persists even if the user doesn't apply it to a slide
        const updatedFrames = await mergeAndSaveFrames(projectId, [newFrame], libraryFrames);
        if (updatedFrames) {
          console.log(`Frame captured and saved to project library`);
        }
        
        toast.success(`Frame captured at ${timestamp}`, { id: toastId });
        
        console.log(`Frame captured and stored with permanent URL: ${permanentUrl}`);
      } else {
        // Create placeholder if extraction failed
        createPlaceholderFrame(currentTimePosition);
        
        toast.error(`Could not capture frame at ${timestamp}`, { id: toastId });
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
  const createPlaceholderFrame = async (timeInSeconds: number) => {
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
    canvas.toBlob(async (blob) => {
      if (blob) {
        // Upload placeholder to storage
        const permanentUrl = await uploadFrameToStorage(blob, timestamp);
        
        if (!permanentUrl) {
          toast.error("Failed to upload placeholder frame");
          return;
        }
        
        // Generate unique ID for the frame
        const frameId = `frame-${Date.now()}-placeholder`;
        
        // Create a new extracted frame with permanent URL
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl: permanentUrl, // Use permanent URL from storage
          timestamp,
          isPlaceholder: true
        };
        
        // Create a captured frame with blob for local use
        const capturedFrame: CapturedFrameWithBlob = {
          ...newFrame,
          blob
        };
        
        // Add to captured frames
        setCapturedFrames(prev => [...prev, capturedFrame]);
        
        // Add to library frames
        setLibraryFrames(prev => {
          const newFrames = [...prev, newFrame];
          // Sort frames by timestamp
          return newFrames.sort((a, b) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp));
        });
        
        // Automatically select the newly captured frame
        setSelectedFrames(prev => ({
          ...prev,
          [frameId]: true
        }));
        
        // Add timemark to the seek bar
        setCapturedTimemarks(prev => [...prev, timeInSeconds]);
        
        toast.info(`Placeholder frame created at ${timestamp}`);
      } else {
        toast.error("Failed to create placeholder frame");
      }
    }, "image/jpeg", 0.95);
  };
  
  // Toggle selection of a frame in library
  const toggleFrameSelection = (frame: ExtractedFrame) => {
    if (!frame.id) return;
    
    setSelectedFrames(prev => {
      const updated = {...prev};
      
      // Toggle selection
      if (updated[frame.id!]) {
        delete updated[frame.id!];
      } else {
        updated[frame.id!] = true;
      }
      
      return updated;
    });
  };
  
  // Remove a frame from the library
  const removeFrame = (frameId: string) => {
    // Find the frame to remove
    const frameToRemove = libraryFrames.find(frame => frame.id === frameId);
    if (frameToRemove) {
      // Remove from captured timemarks if it exists there
      if (frameToRemove.timestamp) {
        const timeInSeconds = timeToSeconds(frameToRemove.timestamp);
        setCapturedTimemarks(prev => prev.filter(time => Math.abs(time - timeInSeconds) > 0.5));
      }
    }
    
    // Remove from library frames
    setLibraryFrames(prev => prev.filter(frame => frame.id !== frameId));
    
    // Remove from selected frames
    setSelectedFrames(prev => {
      const updated = {...prev};
      delete updated[frameId];
      return updated;
    });
    
    // Also remove from captured frames if it exists there
    setCapturedFrames(prev => prev.filter(frame => frame.id !== frameId));
  };
  
  // Apply selected frames to slide with proper upload and frame preservation
  const handleApplyFrames = async () => {
    // Get selected frames from library
    const selectedFramesList = libraryFrames.filter(frame => 
      frame.id && selectedFrames[frame.id]
    );
    
    // Sort frames by timestamp before applying
    const sortedFrames = [...selectedFramesList].sort((a, b) => {
      return timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
    });
    
    if (sortedFrames.length === 0) {
      toast.info("No frames selected");
      return;
    }
    
    setIsUploadingFrames(true);
    const toastId = "processing-frames";
    toast.loading("Processing selected frames...", { id: toastId });
    
    try {
      // Double check: ensure all frames have valid permanent URLs (not blob URLs)
      const validFrames = sortedFrames.filter(frame => 
        frame.imageUrl && !frame.imageUrl.startsWith('blob:')
      );
      
      if (validFrames.length < sortedFrames.length) {
        const invalidFrames = sortedFrames.length - validFrames.length;
        console.warn(`${invalidFrames} frames have temporary URLs and will be skipped`);
        if (validFrames.length === 0) {
          toast.error("No valid frames available. All frames must have permanent URLs.", { id: toastId });
          setIsUploadingFrames(false);
          return;
        } else {
          toast.warning(`${invalidFrames} frames will be skipped due to invalid URLs`, { id: toastId });
        }
      }
      
      // Call the onFramesSelected callback with the selected frames
      // This will apply the selected frames to the current slide
      await onFramesSelected(validFrames);
      
      // Toast will be handled by parent component
      toast.dismiss(toastId);
    } catch (error) {
      console.error("Error in handleApplyFrames:", error);
      toast.error("Failed to process selected frames", { id: toastId });
    } finally {
      setIsUploadingFrames(false);
    }
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
  
  // Get count of selected frames
  const selectedFramesCount = Object.keys(selectedFrames).length;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogTitle>Frame Library</DialogTitle>
        
        {/* Main content area */}
        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* Video player section */}
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
          
          <Separator />
          
          {/* Combined Library & Selected Frames Section */}
          <div className="space-y-2 flex-1 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Frame Library</h3>
              <div className="text-sm text-muted-foreground">
                {selectedFramesCount} frame{selectedFramesCount !== 1 ? 's' : ''} selected
              </div>
            </div>
            
            <div className="h-[300px] bg-muted/30 rounded-md overflow-hidden">
              <ScrollArea className="h-full">
                {libraryFrames.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
                    {libraryFrames.map((frame) => (
                      <div 
                        key={frame.id} 
                        className={`relative aspect-video cursor-pointer rounded-md overflow-hidden border-2 ${
                          selectedFrames[frame.id!] ? 'border-primary' : 'border-transparent'
                        }`}
                        onClick={() => toggleFrameSelection(frame)}
                      >
                        <img
                          src={frame.imageUrl}
                          alt={`Frame at ${frame.timestamp}`}
                          className="h-full w-full object-cover"
                        />
                        <Badge className="absolute top-1 left-1 text-xs">{frame.timestamp}</Badge>
                        {selectedFrames[frame.id!] && (
                          <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-6 w-6 absolute bottom-1 right-1 opacity-0 hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFrame(frame.id as string);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p>No frames in library</p>
                      <p className="text-sm mt-2">Capture frames from the video to add them to the library</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          
          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => {
            // Make sure to properly close and clean up
            toast.dismiss("processing-frames");
            toast.dismiss("capture-frame");
            onClose();
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyFrames} 
            className="gap-1"
            disabled={selectedFramesCount === 0 || isUploadingFrames}
          >
            {isUploadingFrames ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Insert {selectedFramesCount > 0 ? `${selectedFramesCount} Frame${selectedFramesCount !== 1 ? 's' : ''}` : 'to Slide'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
