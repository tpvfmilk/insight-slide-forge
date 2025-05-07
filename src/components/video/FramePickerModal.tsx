
import { useState, useEffect, useRef, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Camera, 
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock
} from "lucide-react";
import { formatDuration } from "@/utils/formatUtils";
import { 
  captureFrameFromVideoElement, 
  uploadManuallySelectedFrame, 
  addManuallySelectedFrameToProject,
  ExtractedFrame 
} from "@/services/clientFrameExtractionService";
import { VideoDetailsCard } from "./VideoDetailsCard";

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
  existingFrames = []
}: FramePickerModalProps) => {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [capturedFrames, setCapturedFrames] = useState<ExtractedFrame[]>([]);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isProcessingComplete, setIsProcessingComplete] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Load video on component mount
  useEffect(() => {
    const loadVideo = async () => {
      if (!open || !videoPath) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Generate the signed URL for the video
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.storage
          .from('video_uploads')
          .createSignedUrl(videoPath, 3600, {
            download: false
          });
          
        if (error || !data?.signedUrl) {
          console.error("Error getting video signed URL:", error);
          setError("Could not access the video. Please check permissions.");
          return;
        }
        
        // Add a cache-busting parameter
        const videoUrlWithCache = new URL(data.signedUrl);
        videoUrlWithCache.searchParams.append('_cache', Date.now().toString());
        
        setVideoUrl(videoUrlWithCache.toString());
        console.log("Successfully loaded video with secure URL");
        
        // Initialize with any existing frames
        if (existingFrames && existingFrames.length > 0) {
          setCapturedFrames(existingFrames);
        }
        
      } catch (error) {
        console.error("Error loading video:", error);
        setError(`Failed to load video: ${(error as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVideo();
  }, [open, videoPath, existingFrames]);
  
  // Handle video metadata loading
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      toast.success("Video loaded successfully");
    }
  };
  
  // Handle video error
  const handleVideoError = () => {
    const videoElement = videoRef.current;
    if (videoElement?.error) {
      setError(`Video failed to load: ${videoElement.error.message}`);
    } else {
      setError("Unknown video loading error");
    }
  };
  
  // Handle play/pause
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.paused = true;
      video.pause();
      setIsPlaying(false);
    }
  };
  
  // Update time display as video plays
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };
  
  // Handle slider change for scrubbing
  const handleSliderChange = (values: number[]) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = values[0];
      setCurrentTime(values[0]);
    }
  };
  
  // Step forward by 1 second
  const stepForward = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.min(video.duration, video.currentTime + 1);
    }
  };
  
  // Step backward by 1 second
  const stepBackward = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - 1);
    }
  };
  
  // Frame step forward (approximately 1/30th of a second)
  const frameStepForward = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.min(video.duration, video.currentTime + 0.033);
    }
  };
  
  // Frame step backward
  const frameStepBackward = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - 0.033);
    }
  };
  
  // Capture current frame
  const captureCurrentFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    
    // Pause the video when capturing
    video.pause();
    setIsPlaying(false);
    
    try {
      setIsCapturing(true);
      
      // Format the current time as a timestamp
      const currentSeconds = video.currentTime;
      const hours = Math.floor(currentSeconds / 3600);
      const minutes = Math.floor((currentSeconds % 3600) / 60);
      const seconds = Math.floor(currentSeconds % 60);
      const timestamp = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Check if we already have a frame at this timestamp
      const existingFrameIndex = capturedFrames.findIndex(frame => frame.timestamp === timestamp);
      if (existingFrameIndex >= 0) {
        toast.info(`A frame at ${timestamp} already exists. Replacing it...`);
      }
      
      // Capture the frame
      const frameBlob = captureFrameFromVideoElement(video, timestamp);
      
      if (!frameBlob) {
        toast.error("Failed to capture the current frame");
        return;
      }
      
      // Upload the captured frame
      const frameInfo = await uploadManuallySelectedFrame(projectId, frameBlob, timestamp);
      
      if (!frameInfo) {
        toast.error("Failed to upload the captured frame");
        return;
      }
      
      // Add the frame to our project
      await addManuallySelectedFrameToProject(projectId, frameInfo);
      
      // Update the state
      if (existingFrameIndex >= 0) {
        // Replace existing frame
        setCapturedFrames(prev => {
          const updated = [...prev];
          updated[existingFrameIndex] = frameInfo;
          return updated;
        });
      } else {
        // Add new frame
        setCapturedFrames(prev => [...prev, frameInfo]);
      }
      
      toast.success(`Frame captured at ${timestamp}`);
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast.error(`Error capturing frame: ${(error as Error).message}`);
    } finally {
      setIsCapturing(false);
    }
  };
  
  // Delete a captured frame
  const deleteFrame = async (timestamp: string) => {
    try {
      // Remove the frame from our state
      setCapturedFrames(prev => prev.filter(frame => frame.timestamp !== timestamp));
      
      // We'll need to update the project with the new frames array
      // First get the project to get the current extracted_frames
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('projects')
        .select('extracted_frames')
        .eq('id', projectId)
        .single();
      
      if (error) {
        console.error("Error fetching project for frame deletion:", error);
        return;
      }
      
      // Get the extracted frames and filter out the one we're deleting
      let extractedFrames: ExtractedFrame[] = [];
      
      if (data?.extracted_frames) {
        if (Array.isArray(data.extracted_frames)) {
          extractedFrames = data.extracted_frames as unknown as ExtractedFrame[];
          extractedFrames = extractedFrames.filter(frame => frame.timestamp !== timestamp);
        }
      }
      
      // Update the project
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          extracted_frames: extractedFrames as unknown as Json
        })
        .eq('id', projectId);
      
      if (updateError) {
        console.error("Error updating project after frame deletion:", updateError);
        toast.error("Failed to remove frame from project");
        return;
      }
      
      toast.success(`Frame at ${timestamp} removed`);
    } catch (error) {
      console.error("Error deleting frame:", error);
      toast.error(`Error: ${(error as Error).message}`);
    }
  };
  
  // Complete the frame selection process
  const completeFrameSelection = () => {
    setIsProcessingComplete(true);
    onComplete(capturedFrames);
  };
  
  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Video Frames</DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-6">
          {/* Video Details Card */}
          {videoMetadata && (
            <div className="mb-6">
              <VideoDetailsCard
                fileName={videoMetadata.original_file_name}
                duration={videoMetadata.duration}
                fileType={videoMetadata.file_type}
                fileSize={videoMetadata.file_size}
              />
            </div>
          )}
          
          {/* Error Display */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}
          
          {/* Video Player */}
          <div className="aspect-video bg-black rounded-md overflow-hidden">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onLoadedMetadata={handleVideoLoaded}
                onError={handleVideoError}
                onTimeUpdate={handleTimeUpdate}
                crossOrigin="anonymous"
                preload="auto"
                playsInline
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-white">
                  <RefreshCw className="h-8 w-8 animate-spin mb-2 mx-auto" />
                  <p>Loading video...</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Video Controls */}
          <div className="space-y-4">
            {/* Time Display */}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            {/* Scrubbing Slider */}
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSliderChange}
              disabled={!videoUrl}
              className="w-full"
            />
            
            {/* Playback Controls */}
            <div className="flex justify-center items-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                onClick={stepBackward}
                disabled={!videoUrl || currentTime <= 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={frameStepBackward}
                disabled={!videoUrl || currentTime <= 0}
              >
                <SkipBack className="h-3 w-3" />
              </Button>
              
              <Button 
                onClick={togglePlayback} 
                disabled={!videoUrl}
                variant="outline"
                size="icon"
                className="h-10 w-10"
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
                onClick={frameStepForward}
                disabled={!videoUrl || currentTime >= duration}
              >
                <SkipForward className="h-3 w-3" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={stepForward}
                disabled={!videoUrl || currentTime >= duration}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Capture Button */}
            <div className="flex justify-center mt-4">
              <Button
                onClick={captureCurrentFrame}
                disabled={!videoUrl || isCapturing}
                className="px-6"
              >
                {isCapturing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Frame at {formatTime(currentTime)}
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Captured Frames Grid */}
          {capturedFrames.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-medium">Captured Frames ({capturedFrames.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {capturedFrames.map((frame, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-video bg-muted rounded-md overflow-hidden">
                      <img
                        src={frame.imageUrl}
                        alt={`Frame at ${frame.timestamp}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 flex justify-between items-center">
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{frame.timestamp}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-white hover:text-red-500"
                        onClick={() => deleteFrame(frame.timestamp)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            <Button
              onClick={completeFrameSelection}
              disabled={capturedFrames.length === 0 || isProcessingComplete}
            >
              {isProcessingComplete ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Frames Applied
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apply {capturedFrames.length} Frames to Project
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
