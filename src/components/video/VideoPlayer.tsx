
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Rewind, FastForward, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VideoPlayerProps {
  videoPath: string;
  projectId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onVideoLoaded?: (duration: number) => void;
  capturedTimemarks?: number[];
  isCapturingFrame?: boolean;
}

export const VideoPlayer = ({
  videoPath,
  projectId,
  onTimeUpdate,
  onVideoLoaded,
  capturedTimemarks = [],
  isCapturingFrame = false
}: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekingValue, setSeekingValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [loadAttempts, setLoadAttempts] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Format time display (seconds to MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
  
  // Load video on mount
  useEffect(() => {
    loadVideo();
  }, [videoPath, loadAttempts]);

  // Update time display when video is playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const updateTime = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
        setSeekingValue(video.currentTime);
        onTimeUpdate?.(video.currentTime);
      }
    };
    
    video.addEventListener('timeupdate', updateTime);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
    };
  }, [isSeeking, onTimeUpdate]);

  // Handle video duration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      onVideoLoaded?.(video.duration);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [onVideoLoaded]);
  
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
    onTimeUpdate?.(video.currentTime);
  };

  // Seek forward 5 seconds
  const seekForward = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
    setCurrentTime(video.currentTime);
    setSeekingValue(video.currentTime);
    onTimeUpdate?.(video.currentTime);
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
    onTimeUpdate?.(seekingValue);
  };
  
  // Handle video load events
  const handleVideoLoaded = () => {
    setIsVideoLoaded(true);
    setVideoError(null);
    setIsLoadingVideo(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      onVideoLoaded?.(videoRef.current.duration);
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
          
          {/* Child components can render additional buttons here */}
        </div>
        
        {/* Video seek slider with markers */}
        <div className="px-1">
          {renderSliderWithMarkers()}
        </div>
      </div>
    </div>
  );
};
