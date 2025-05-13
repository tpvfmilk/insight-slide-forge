
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

  return (
    <div className="relative w-full bg-black aspect-video rounded-md overflow-hidden">
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
        className="w-full h-full"
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
