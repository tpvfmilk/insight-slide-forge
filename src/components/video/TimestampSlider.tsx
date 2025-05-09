
import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { timestampToSeconds, formatDuration } from "@/utils/formatUtils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TimestampSliderProps {
  timestamps: string[];
  videoDuration: number;
  currentTime?: number;
  onTimeChange?: (time: number) => void;
  onTimestampClick?: (timestamp: string) => void;
  className?: string;
}

export const TimestampSlider = ({
  timestamps,
  videoDuration,
  currentTime = 0,
  onTimeChange,
  onTimestampClick,
  className
}: TimestampSliderProps) => {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Validate timestamps against video duration
  const validatedTimestamps = timestamps
    .map(timestamp => {
      const seconds = timestampToSeconds(timestamp);
      return {
        timestamp,
        seconds,
        isValid: seconds <= videoDuration
      };
    })
    .sort((a, b) => a.seconds - b.seconds);

  // Handle slider value change
  const handleValueChange = (value: number[]) => {
    if (onTimeChange) {
      onTimeChange(value[0]);
    }
  };

  // Calculate marker positions as percentages of the video duration
  const markers = validatedTimestamps.map(({ timestamp, seconds, isValid }) => {
    const position = Math.min(100, (seconds / videoDuration) * 100);
    return { timestamp, position, isValid };
  });

  // Calculate position of the timeline indicator
  const currentTimePosition = (currentTime / videoDuration) * 100;

  return (
    <div className={cn("relative pt-8 pb-8", className)}>
      {/* Video timeline strip */}
      <div className="absolute w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
        {/* Timeline fill */}
        <div 
          className="absolute top-0 left-0 h-full bg-primary/30"
          style={{ width: `${currentTimePosition}%` }}
        />
        
        {/* Current time indicator */}
        <div 
          className="absolute top-0 h-full w-1 bg-primary z-10"
          style={{ left: `${currentTimePosition}%` }}
        />
      </div>
      
      {/* Timestamp markers */}
      <div className="absolute w-full top-0 h-6">
        <TooltipProvider>
          {markers.map(({ timestamp, position, isValid }) => (
            <Tooltip key={timestamp}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "absolute top-1 w-1 h-4 rounded-full transform -translate-x-1/2 cursor-pointer",
                    isValid ? "bg-primary" : "bg-destructive"
                  )}
                  style={{ left: `${position}%` }}
                  onClick={() => onTimestampClick && onTimestampClick(timestamp)}
                >
                  <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant={isValid ? "default" : "destructive"}>
                      {timestamp}
                    </Badge>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {timestamp} {!isValid && " (exceeds video duration)"}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      {/* Main slider */}
      <Slider
        value={[currentTime]}
        max={videoDuration}
        step={0.001}
        onValueChange={handleValueChange}
        onPointerDown={() => setIsDragging(true)}
        onPointerUp={() => setIsDragging(false)}
        className="mt-2"
      />

      {/* Time indicators */}
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>00:00</span>
        <span>
          {hoveredTime !== null
            ? formatDuration(hoveredTime)
            : formatDuration(videoDuration)}
        </span>
      </div>
    </div>
  );
};
