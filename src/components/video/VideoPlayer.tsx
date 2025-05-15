import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Rewind, FastForward, Camera, RefreshCw, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  seekingValue: number;
  isVideoLoaded: boolean;
  isLoadingVideo: boolean;
  videoError: string | null;
  capturedTimemarks: number[];
  chunkTimemarks?: number[]; // Add chunk timemarks prop
  isCapturingFrame: boolean;
  formatTime: (seconds: number) => string;
  togglePlayPause: () => void;
  seekBack: () => void;
  seekForward: () => void;
  handleSeekStart: () => void;
  handleSeekChange: (value: number[]) => void;
  handleSeekEnd: () => void;
  retryLoadVideo: () => void;
  handleVideoLoaded: () => void;
  handleVideoError: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onCaptureFrame: () => void;
  getChunkInfoAtTime?: (time: number) => string | null; // Optional function to get chunk info
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  videoUrl,
  isPlaying,
  currentTime,
  duration,
  seekingValue,
  isVideoLoaded,
  isLoadingVideo,
  videoError,
  capturedTimemarks,
  chunkTimemarks = [], // Default to empty array if not provided
  isCapturingFrame,
  formatTime,
  togglePlayPause,
  seekBack,
  seekForward,
  handleSeekStart,
  handleSeekChange,
  handleSeekEnd,
  retryLoadVideo,
  handleVideoLoaded,
  handleVideoError,
  onCaptureFrame,
  getChunkInfoAtTime
}) => {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  
  // Custom render for slider with captured frame markers and chunk markers
  const renderSliderWithMarkers = () => {
    return (
      <TooltipProvider>
        <div 
          className="relative w-full" 
          onMouseLeave={() => setHoveredTime(null)}
        >
          <Slider 
            value={[seekingValue]} 
            min={0} 
            max={duration || 100}
            step={0.01}
            onValueChange={handleSeekChange}
            onValueCommit={handleSeekEnd}
            onPointerDown={handleSeekStart}
            className="z-10"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              const time = pos * (duration || 100);
              setHoveredTime(time);
            }}
          />
          
          {/* Chunk markers - blue/purple indicators */}
          {chunkTimemarks.map((time, index) => (
            <Tooltip key={`chunk-${index}`}>
              <TooltipTrigger asChild>
                <div 
                  className="absolute top-1/2 w-1 h-5 bg-blue-500 rounded-full transform -translate-y-1/2 z-0 cursor-pointer"
                  style={{ 
                    left: `${(time / (duration || 100)) * 100}%`,
                    marginLeft: -2 // Center the marker
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="z-50">
                <p>
                  Video chunk at {formatTime(time)}
                  {getChunkInfoAtTime && getChunkInfoAtTime(time) ? 
                    ` - ${getChunkInfoAtTime(time)}` : ''}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
          
          {/* Timemark indicators - Green color for captured frames */}
          {capturedTimemarks.map((time, index) => (
            <Tooltip key={`frame-${index}`}>
              <TooltipTrigger asChild>
                <div 
                  className="absolute top-1/2 w-1 h-4 bg-green-500 rounded-full transform -translate-y-1/2 z-0 cursor-pointer"
                  style={{ 
                    left: `${(time / (duration || 100)) * 100}%`,
                    marginLeft: -2 // Center the marker
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="z-50">
                <p>Captured frame at {formatTime(time)}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          
          {/* Current position indicator with time tooltip */}
          {hoveredTime !== null && (
            <div 
              className="absolute top-0 -translate-y-6 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none"
              style={{ 
                left: `${(hoveredTime / (duration || 100)) * 100}%` 
              }}
            >
              {formatTime(hoveredTime)}
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="relative bg-black rounded-md overflow-hidden" style={{ width: "640px", height: "360px" }}>
      {/* Loading state */}
      {isLoadingVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
          <RefreshCw className="h-8 w-8 animate-spin mr-2" />
          <span>Loading video...</span>
        </div>
      ) : null}
      
      {/* Error state */}
      {videoError ? (
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
      
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl || undefined}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        onLoadedData={handleVideoLoaded}
        onLoadedMetadata={handleVideoLoaded}
        onError={handleVideoError}
        playsInline
        preload="auto"
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
            onClick={onCaptureFrame}
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
  );
};
