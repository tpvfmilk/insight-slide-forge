
// Use existing imports and add our new hook
import React, { useEffect } from "react";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { useChunkedVideoPlayer } from "@/hooks/useChunkedVideoPlayer";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, SkipBack, SkipForward, 
  RefreshCw, AlertCircle, LoaderCircle, Camera
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface VideoPlayerProps {
  videoPath: string;
  projectId: string;
  videoMetadata?: any;
  onTimeUpdate?: (time: number) => void;
  width?: number;
  height?: number;
  className?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  // Add these new props for frame capture functionality
  capturedTimemarks?: number[];
  isCapturingFrame?: boolean;
  onCaptureFrame?: () => Promise<void>;
}

export const VideoPlayer = ({ 
  videoPath, 
  projectId, 
  videoMetadata,
  onTimeUpdate,
  width = 640,
  height = 360,
  className = "",
  autoPlay = false,
  showControls = true,
  capturedTimemarks = [],
  isCapturingFrame = false,
  onCaptureFrame
}: VideoPlayerProps) => {
  // Check if the video is chunked from metadata
  const isChunkedVideo = videoMetadata?.chunked_video_metadata?.isChunked === true;
  
  // Use either standard or chunked video player based on metadata
  const standardPlayer = useVideoPlayer({ videoPath, projectId });
  const chunkedPlayer = useChunkedVideoPlayer({ 
    videoMetadata, 
    projectId,
    normalVideoPath: videoPath
  });
  
  // Use the appropriate player
  const player = isChunkedVideo ? chunkedPlayer : standardPlayer;
  
  // Report time updates to parent if needed
  useEffect(() => {
    if (onTimeUpdate && !player.isSeeking) {
      onTimeUpdate(player.currentTime);
    }
  }, [player.currentTime, player.isSeeking, onTimeUpdate]);

  // Render timemark indicators for captured frames
  const renderTimemarks = () => {
    if (!capturedTimemarks || capturedTimemarks.length === 0 || !player.duration) {
      return null;
    }

    return (
      <div className="relative w-full h-1 mb-2">
        {capturedTimemarks.map((time, index) => {
          const position = (time / player.duration) * 100;
          return (
            <div 
              key={`mark-${index}`}
              className="absolute w-0.5 h-2 bg-primary rounded-full -translate-x-1/2" 
              style={{ left: `${position}%` }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex flex-col w-full max-w-full ${className}`}>
      {/* Video element */}
      <div 
        className={`relative bg-black rounded-md overflow-hidden ${player.isLoadingVideo ? 'flex items-center justify-center' : ''}`}
        style={{ width: width || '100%', height: height || 'auto' }}
      >
        {player.isLoadingVideo ? (
          <div className="flex flex-col items-center gap-2 text-white bg-black/70 p-4 rounded-md">
            <LoaderCircle className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading video...</span>
          </div>
        ) : player.videoError ? (
          <div className="flex flex-col items-center justify-center h-full text-white bg-black/90 p-4">
            <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
            <p className="text-center text-sm max-w-[80%]">{player.videoError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={isChunkedVideo ? chunkedPlayer.loadVideos : standardPlayer.retryLoadVideo}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={player.videoRef}
              className={`w-full h-full object-contain ${player.isVideoLoaded ? 'block' : 'hidden'}`}
              src={isChunkedVideo ? chunkedPlayer.activeChunkUrl : standardPlayer.videoUrl || undefined}
              onLoadedData={player.handleVideoLoaded}
              onError={player.handleVideoError}
              playsInline
              autoPlay={autoPlay}
              muted={autoPlay}
              controls={false}
            />
            {onCaptureFrame && (
              <Button 
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2 z-10 opacity-80 hover:opacity-100"
                onClick={onCaptureFrame}
                disabled={isCapturingFrame}
              >
                {isCapturingFrame ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Camera className="h-4 w-4 mr-1" />
                )}
                Capture Frame
              </Button>
            )}
          </>
        )}
      </div>

      {/* Video controls */}
      {showControls && player.isVideoLoaded && (
        <div className="mt-2 space-y-2">
          {/* Timemarks */}
          {renderTimemarks()}
          
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono w-12">
              {player.formatTime(player.currentTime)}
            </span>
            <Slider 
              min={0} 
              max={player.duration || 100}
              step={0.01}
              value={[player.seekingValue !== null ? player.seekingValue : player.currentTime]}
              onValueChange={(vals) => player.handleSeekChange(vals[0])}
              onValueCommit={(vals) => player.handleSeekCommit(vals[0])}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground font-mono w-12">
              {player.formatTime(player.duration)}
            </span>
          </div>
          
          {/* Playback controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => player.skipBackward(10)}
                disabled={player.isLoadingVideo}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={player.togglePlayback}
                disabled={player.isLoadingVideo}
              >
                {player.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => player.skipForward(10)}
                disabled={player.isLoadingVideo}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
            
            {isChunkedVideo && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    Chunk {chunkedPlayer.currentChunkIndex + 1}/{chunkedPlayer.chunks?.length || 1}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="flex flex-wrap gap-1 p-2 bg-muted/20 rounded-md max-w-xs">
                    {chunkedPlayer.chunks?.map((_, index) => (
                      <Button
                        key={`chunk-${index}`}
                        variant={index === chunkedPlayer.currentChunkIndex ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => chunkedPlayer.loadChunk(index)}
                      >
                        {index + 1}
                      </Button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
