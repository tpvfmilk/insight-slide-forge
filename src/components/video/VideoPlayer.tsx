
import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, RefreshCw, Camera } from "lucide-react";

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
  capturedTimemarks?: number[];
  chunkTimemarks?: number[];
  isCapturingFrame?: boolean;
  formatTime: (seconds: number) => string;
  togglePlayPause: () => void;
  seekBack: () => void;
  seekForward: () => void;
  handleSeekStart: () => void;
  handleSeekChange: (value: number[]) => void;
  handleSeekEnd: () => void;
  retryLoadVideo?: () => void;
  handleVideoLoaded?: () => void;
  handleVideoError?: (e: any) => void;
  onCaptureFrame?: () => Promise<void>;
  getChunkInfoAtTime?: (time: number) => string | { chunkIndex: number; isInChunk: boolean; nextChunkTime: number } | null;
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
  capturedTimemarks = [],
  chunkTimemarks = [],
  isCapturingFrame = false,
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
  getChunkInfoAtTime,
}) => {
  // Function to render chunk info safely
  const renderChunkInfo = () => {
    if (!getChunkInfoAtTime) return null;
    
    const chunkInfo = getChunkInfoAtTime(currentTime);
    if (!chunkInfo) return null;
    
    // If it's a string, return it directly
    if (typeof chunkInfo === 'string') {
      return chunkInfo;
    }
    
    // If it's an object, format it properly
    return `Chunk ${chunkInfo.chunkIndex >= 0 ? chunkInfo.chunkIndex + 1 : 'N/A'}`;
  };

  return (
    <div className="flex flex-col w-full overflow-hidden">
      {/* Video error state */}
      {videoError && !isVideoLoaded && !isLoadingVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
          <p className="text-white text-sm mb-2">Failed to load video: {videoError}</p>
          {retryLoadVideo && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={retryLoadVideo}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          )}
        </div>
      )}
      
      {/* Loading state */}
      {isLoadingVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
            <span className="text-white text-sm">Loading video...</span>
          </div>
        </div>
      )}
      
      {/* Video element */}
      <video
        ref={videoRef}
        className={cn(
          "w-full h-full object-contain bg-black",
          (isLoadingVideo || !isVideoLoaded) && "opacity-50"
        )}
        src={videoUrl || undefined}
        onLoadedData={handleVideoLoaded}
        onError={handleVideoError}
      ></video>

      {/* Controls */}
      <div className="bg-background p-2 border-t">
        {/* Seek bar */}
        <div className="relative w-full h-6 mb-2">
          <Slider
            value={[seekingValue]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeekChange}
            onValueCommit={() => handleSeekEnd()}
            onPointerDown={handleSeekStart}
            disabled={!isVideoLoaded}
            className="h-1.5"
          />
          
          {/* Timemarks for captured frames */}
          {capturedTimemarks.map((time, index) => {
            const position = (time / (duration || 100)) * 100;
            return (
              <div
                key={`timemark-${index}`}
                className="absolute w-1 h-4 bg-green-500 rounded-full -mt-1 transform -translate-x-1/2 z-10"
                style={{
                  left: `${position}%`,
                  top: '6px',
                }}
              ></div>
            );
          })}
          
          {/* Timemarks for video chunks */}
          {chunkTimemarks.map((time, index) => {
            const position = (time / (duration || 100)) * 100;
            return (
              <div
                key={`chunk-${index}`}
                className="absolute w-1 h-4 bg-blue-500 rounded-full -mt-1 transform -translate-x-1/2 z-5"
                style={{
                  left: `${position}%`,
                  top: '6px',
                }}
              ></div>
            );
          })}
        </div>
        
        {/* Time display and controls */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </div>

          <div className="flex space-x-2 items-center">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={seekBack} 
              disabled={!isVideoLoaded}
              className="h-8 w-8"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="default" 
              size="icon" 
              onClick={togglePlayPause} 
              disabled={!isVideoLoaded}
              className="h-9 w-9"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={seekForward} 
              disabled={!isVideoLoaded}
              className="h-8 w-8"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            
            {/* Capture frame button */}
            {onCaptureFrame && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onCaptureFrame}
                disabled={!isVideoLoaded || isCapturingFrame}
                className="ml-2 flex items-center gap-1"
              >
                {isCapturingFrame ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Capturing...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    <span>Capture Frame</span>
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Current chunk info - only shown if we're using chunked video */}
          {getChunkInfoAtTime && renderChunkInfo() && (
            <div className="text-xs text-muted-foreground">
              {renderChunkInfo()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
