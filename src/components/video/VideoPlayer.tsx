
import { ReactNode } from "react";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { VideoControls } from "@/components/video/VideoControls";
import { VideoOverlay } from "@/components/video/VideoOverlay";

interface VideoPlayerProps {
  videoPath: string;
  projectId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onVideoLoaded?: (duration: number) => void;
  onVideoUrlUpdate?: (url: string) => void;
  capturedTimemarks?: number[];
  isCapturingFrame?: boolean;
  children?: ReactNode;
}

export const VideoPlayer = ({
  videoPath,
  projectId,
  onTimeUpdate,
  onVideoLoaded,
  onVideoUrlUpdate,
  capturedTimemarks = [],
  isCapturingFrame = false,
  children
}: VideoPlayerProps) => {
  const {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    seekingValue,
    videoUrl,
    videoError,
    isVideoLoaded,
    isLoadingVideo,
    togglePlayPause,
    seekBack,
    seekForward,
    handleSeekStart,
    handleSeekChange,
    handleSeekEnd,
    handleVideoLoaded,
    handleVideoError,
    retryLoadVideo
  } = useVideoPlayer({
    videoPath,
    projectId,
    onTimeUpdate,
    onVideoLoaded,
    onVideoUrlUpdate
  });

  // Debug logging to track videoUrl
  console.log("VideoPlayer component - videoUrl state:", videoUrl ? "Available" : "Not available");
  console.log("VideoPlayer component - videoPath prop:", videoPath);
  console.log("VideoPlayer component - projectId prop:", projectId);
  
  return (
    <div className="relative w-full bg-black aspect-video rounded-md overflow-hidden">
      {/* Error and loading overlays */}
      <VideoOverlay 
        isLoading={isLoadingVideo}
        error={videoError}
        onRetry={retryLoadVideo}
      />
      
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
      
      {/* Video controls */}
      <VideoControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        seekingValue={seekingValue}
        isVideoLoaded={isVideoLoaded}
        onPlay={togglePlayPause}
        onSeekStart={handleSeekStart}
        onSeekChange={handleSeekChange}
        onSeekEnd={handleSeekEnd}
        onSeekBack={seekBack}
        onSeekForward={seekForward}
        capturedTimemarks={capturedTimemarks}
      />
      
      {/* Additional content */}
      {children}
    </div>
  );
};
