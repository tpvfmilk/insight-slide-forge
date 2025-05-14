
import React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Rewind, FastForward, Camera, RefreshCw, AlertCircle } from "lucide-react";

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
  onCaptureFrame
}) => {
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

  // Handle appearance during loading/error states
  const renderVideoContent = () => {
    if (videoError) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <AlertCircle className="h-10 w-10 mb-2 text-destructive" />
          <p className="text-center text-muted-foreground mb-2">Failed to load video</p>
          <Button variant="outline" size="sm" onClick={retryLoadVideo}>
            Try Again
          </Button>
        </div>
      );
    }

    if (isLoadingVideo) {
      return (
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <video
        ref={videoRef}
        className="w-full h-full bg-black"
        onLoadedData={handleVideoLoaded}
        onError={handleVideoError}
        crossOrigin="anonymous"
      >
        <source src={videoUrl || ''} />
        Your browser does not support the video tag.
      </video>
    );
  };

  return (
    <div className="space-y-2 w-full">
      <div className="relative rounded-md overflow-hidden bg-black/10 border" style={{ height: "230px" }}>
        {renderVideoContent()}
      </div>
      
      <div className="space-y-2 px-1">
        {/* Time and controls */}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        
        {/* Progress slider with markers */}
        {renderSliderWithMarkers()}
        
        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={seekBack}
              disabled={!isVideoLoaded}
            >
              <Rewind className="h-4 w-4" />
              <span className="sr-only">Rewind</span>
            </Button>
            
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8"
              onClick={togglePlayPause}
              disabled={!isVideoLoaded}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span className="sr-only">{isPlaying ? 'Pause' : 'Play'}</span>
            </Button>
            
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8"
              onClick={seekForward}
              disabled={!isVideoLoaded}
            >
              <FastForward className="h-4 w-4" />
              <span className="sr-only">Fast Forward</span>
            </Button>
          </div>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={onCaptureFrame}
            disabled={!isVideoLoaded || isCapturingFrame}
            className="h-8"
          >
            {isCapturingFrame ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Capturing...
              </>
            ) : (
              <>
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                Capture Frame
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
