
import React, { useEffect, useRef, useState } from 'react';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useChunkedVideoPlayer } from '@/hooks/useChunkedVideoPlayer';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PlayCircle, PauseCircle, SkipBack, SkipForward, Camera } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface VideoPlayerProps {
  videoPath: string;
  projectId: string;
  width?: number;
  height?: number;
  className?: string;
  onTimeUpdate?: (time: number) => void;
  capturedTimemarks?: number[];
  isCapturingFrame?: boolean;
  onCaptureFrame?: () => void;
  videoMetadata?: any;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoPath,
  projectId,
  width = 640,
  height = 360,
  className = '',
  onTimeUpdate,
  capturedTimemarks = [],
  isCapturingFrame = false,
  onCaptureFrame,
  videoMetadata
}) => {
  const [isChunked, setIsChunked] = useState(false);
  
  useEffect(() => {
    if (videoMetadata?.chunked_video_metadata?.isChunked) {
      console.log("Using chunked video player");
      setIsChunked(true);
    } else {
      console.log("Using standard video player");
      setIsChunked(false);
    }
  }, [videoMetadata]);
  
  // Use the appropriate player based on whether video is chunked
  const standardPlayer = useVideoPlayer({ videoPath, projectId });
  const chunkedPlayer = useChunkedVideoPlayer({ 
    videoMetadata, 
    projectId, 
    normalVideoPath: videoPath 
  });
  
  // Determine which player to use
  const player = isChunked ? chunkedPlayer : standardPlayer;
  
  // Pass time updates to parent component
  useEffect(() => {
    if (onTimeUpdate) {
      onTimeUpdate(player.currentTime);
    }
  }, [player.currentTime, onTimeUpdate]);

  // Manage captured timemarks visualization
  const [capturedPositions, setCapturedPositions] = useState<number[]>([]);
  
  useEffect(() => {
    if (capturedTimemarks && player.duration) {
      // Convert timestamps to positions as percentage of duration
      const positions = capturedTimemarks.map(time => 
        (time / player.duration) * 100
      );
      setCapturedPositions(positions);
    }
  }, [capturedTimemarks, player.duration]);
  
  return (
    <div 
      className={`flex flex-col overflow-hidden rounded-lg border bg-background ${className}`}
      style={{ width: width }}
    >
      <div 
        className="relative bg-black"
        style={{ height: height }}
      >
        {/* Video loading skeleton */}
        {player.isLoadingVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        )}
        
        {/* Video error message */}
        {player.videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <p className="mb-4 text-red-500">{player.videoError}</p>
            <Button onClick={isChunked ? chunkedPlayer.loadVideos : standardPlayer.retryLoadVideo}>
              Retry Loading
            </Button>
          </div>
        )}
        
        {/* Capture frame overlay */}
        {isCapturingFrame && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="animate-pulse">
              <Camera className="h-12 w-12 text-white" />
            </div>
          </div>
        )}
        
        {/* Actual video element */}
        <video
          ref={player.videoRef}
          className="h-full w-full object-contain"
          onLoadedData={player.handleVideoLoaded}
          onError={player.handleVideoError}
          src={isChunked ? chunkedPlayer.activeChunkUrl || undefined : standardPlayer.videoUrl || undefined}
          controls={false}
        />
      </div>
      
      {/* Video controls */}
      <div className="flex flex-col p-2">
        {/* Time slider */}
        <div className="relative mb-2">
          <Slider
            value={[player.seekingValue]}
            min={0}
            max={player.duration || 100}
            step={0.1}
            onValueChange={(values) => {
              if (isChunked) {
                chunkedPlayer.handleSeekChange(values[0]);
              } else {
                standardPlayer.handleSeekChange(values);
              }
            }}
            onValueCommit={(values) => {
              if (isChunked) {
                chunkedPlayer.handleSeekCommit(values[0]);
              } else {
                // Fix: Pass the first item in the array to handleSeekEnd
                standardPlayer.handleSeekEnd();
              }
            }}
            disabled={player.isLoadingVideo || !!player.videoError}
            onPointerDown={() => {
              if (isChunked) {
                chunkedPlayer.handleSeekStart();
              } else {
                standardPlayer.handleSeekStart();
              }
            }}
          />
          
          {/* Render captured timemarks as markers */}
          {capturedPositions.map((position, index) => (
            <div
              key={`timemark-${index}`}
              className="absolute top-0 h-full w-0.5 bg-green-500"
              style={{
                left: `${position}%`,
              }}
            />
          ))}
        </div>
        
        {/* Playback controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (isChunked) {
                  chunkedPlayer.togglePlayback();
                } else {
                  standardPlayer.togglePlayPause();
                }
              }}
              disabled={player.isLoadingVideo || !!player.videoError}
            >
              {player.isPlaying ? (
                <PauseCircle className="h-5 w-5" />
              ) : (
                <PlayCircle className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (isChunked) {
                  chunkedPlayer.skipBackward(5);
                } else {
                  standardPlayer.seekBack();
                }
              }}
              disabled={player.isLoadingVideo || !!player.videoError}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (isChunked) {
                  chunkedPlayer.skipForward(5);
                } else {
                  standardPlayer.seekForward();
                }
              }}
              disabled={player.isLoadingVideo || !!player.videoError}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            
            {onCaptureFrame && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCaptureFrame}
                disabled={player.isLoadingVideo || !!player.videoError || isCapturingFrame}
                className="ml-2"
              >
                <Camera className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            {player.formatTime(player.currentTime)} / {player.formatTime(player.duration || 0)}
          </div>
        </div>
      </div>
    </div>
  );
};
