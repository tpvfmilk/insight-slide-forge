
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Rewind, FastForward } from "lucide-react";
import { formatTime } from "@/utils/videoUtils";

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  seekingValue: number;
  isVideoLoaded: boolean;
  onPlay: () => void;
  onSeekStart: () => void;
  onSeekChange: (value: number[]) => void;
  onSeekEnd: () => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  capturedTimemarks?: number[];
}

export const VideoControls = ({
  isPlaying,
  currentTime,
  duration,
  seekingValue,
  isVideoLoaded,
  onPlay,
  onSeekStart,
  onSeekChange,
  onSeekEnd,
  onSeekBack,
  onSeekForward,
  capturedTimemarks = []
}: VideoControlsProps) => {
  // Improved slider with optimized event handlers for seeking
  const renderSliderWithMarkers = () => {
    // Log seek interactions for debugging
    const handleSeekStart = () => {
      console.log("[VideoControls] Seek start triggered");
      onSeekStart();
    };
    
    const handleSeekChange = (val: number[]) => {
      console.log(`[VideoControls] Seek change to ${val[0].toFixed(2)}`);
      onSeekChange(val);
    };
    
    const handleSeekEnd = () => {
      console.log("[VideoControls] Seek end triggered");
      onSeekEnd();
    };
    
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
          disabled={!isVideoLoaded || duration <= 0}
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

  // Log control interactions for debugging
  const handlePlayPause = () => {
    console.log(`[VideoControls] ${isPlaying ? 'Pause' : 'Play'} button clicked`);
    onPlay();
  };
  
  const handleSeekBack = () => {
    console.log("[VideoControls] Seek back button clicked");
    onSeekBack();
  };
  
  const handleSeekForward = () => {
    console.log("[VideoControls] Seek forward button clicked");
    onSeekForward();
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3 flex flex-col space-y-2">
      <div className="flex items-center space-x-4 w-full">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSeekBack}
          className="text-white hover:bg-white/20"
          disabled={!isVideoLoaded}
        >
          <Rewind className="h-5 w-5" />
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handlePlayPause}
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
          onClick={handleSeekForward}
          className="text-white hover:bg-white/20"
          disabled={!isVideoLoaded}
        >
          <FastForward className="h-5 w-5" />
        </Button>
        
        <div className="text-white text-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        
        <div className="flex-1"></div>
      </div>
      
      <div className="px-1">
        {renderSliderWithMarkers()}
      </div>
    </div>
  );
};
