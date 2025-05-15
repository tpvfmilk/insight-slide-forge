
// Use existing imports and add our new hook
import React from "react";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { useChunkedVideoPlayer } from "@/hooks/useChunkedVideoPlayer";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, SkipBack, SkipForward, 
  RefreshCw, AlertCircle, LoaderCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  showControls = true
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
  React.useEffect(() => {
    if (onTimeUpdate && !player.isSeeking) {
      onTimeUpdate(player.currentTime);
    }
  }, [player.currentTime, player.isSeeking, onTimeUpdate]);

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
              onClick={isChunkedVideo ? () => chunkedPlayer.loadVideos() : standardPlayer.retryLoadVideo}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : (
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
            onClick={() => showControls && player.togglePlayPause()}
          />
        )}
        
        {!player.isVideoLoaded && !player.videoError && !player.isLoadingVideo && (
          <Skeleton className="w-full h-full absolute inset-0" />
        )}
      </div>
      
      {/* Video controls */}
      {showControls && player.isVideoLoaded && (
        <div className="mt-2 bg-muted/50 p-2 rounded-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-muted-foreground">
              {player.formatTime(player.currentTime)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={player.seekBack}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={player.togglePlayPause}
              >
                {player.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={player.seekForward}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-sm text-muted-foreground">
              {player.formatTime(player.duration)}
            </span>
          </div>
          
          <Slider
            min={0}
            max={player.duration}
            step={0.01}
            value={[player.seekingValue]}
            onValueChange={player.handleSeekChange}
            onValueCommit={() => player.handleSeekEnd()}
            className="cursor-pointer"
          />
          
          {/* Display chunk information when playing chunked videos */}
          {isChunkedVideo && chunkedPlayer.isChunked && (
            <div className="text-xs text-muted-foreground mt-1">
              Part {chunkedPlayer.activeChunkIndex + 1} of {videoMetadata.chunked_video_metadata.chunks.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
