
import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TranscriptSegment {
  text: string;
  speaker?: number | string;
  timestamp?: string;
}

interface TranscriptRendererProps {
  transcript: string;
  highlightSpeakers?: boolean;
  showTimestamps?: boolean;
  className?: string;
}

export const TranscriptRenderer: React.FC<TranscriptRendererProps> = ({
  transcript,
  highlightSpeakers = true,
  showTimestamps = true,
  className
}) => {
  // Parse the transcript into segments with speaker identification
  const segments = useMemo(() => {
    if (!transcript) return [];
    
    const parsedSegments: TranscriptSegment[] = [];
    const speakerRegex = /(?:^|\n\n)(Speaker \d+|[A-Za-z\s]+): ([\s\S]*?)(?=\n\n(?:Speaker \d+|[A-Za-z\s]+): |$)/g;
    const timestampRegex = /\[([0-9:]+)\]/g;
    
    // Check if transcript has speaker labels
    let match;
    let hasMatches = false;
    
    while ((match = speakerRegex.exec(transcript)) !== null) {
      hasMatches = true;
      const speaker = match[1];
      let text = match[2];
      
      // Extract timestamp if present
      let timestamp;
      const timestampMatch = text.match(timestampRegex);
      if (timestampMatch) {
        timestamp = timestampMatch[0].replace('[', '').replace(']', '');
        text = text.replace(timestampRegex, '').trim();
      }
      
      parsedSegments.push({ speaker, text, timestamp });
    }
    
    // If no speaker segments were found, split by timestamps or return as single segment
    if (!hasMatches) {
      if (showTimestamps) {
        // Try to split by timestamp markers
        const parts = transcript.split(/\[([0-9:]+)\]/g);
        
        for (let i = 1; i < parts.length; i += 2) {
          if (i + 1 < parts.length) {
            parsedSegments.push({
              text: parts[i + 1].trim(),
              timestamp: parts[i]
            });
          }
        }
        
        // If no timestamps found, return as a single segment
        if (parsedSegments.length === 0) {
          parsedSegments.push({ text: transcript });
        }
      } else {
        parsedSegments.push({ text: transcript });
      }
    }
    
    return parsedSegments;
  }, [transcript]);
  
  // Generate a color for a speaker based on their ID
  const getSpeakerColor = (speaker: string | number | undefined) => {
    if (!speaker) return "text-foreground";
    
    const speakerId = typeof speaker === 'string' 
      ? speaker.replace(/[^0-9]/g, '') 
      : speaker;
    
    const colors = [
      "text-blue-600 dark:text-blue-400",
      "text-green-600 dark:text-green-400",
      "text-purple-600 dark:text-purple-400",
      "text-amber-600 dark:text-amber-400",
      "text-red-600 dark:text-red-400",
      "text-cyan-600 dark:text-cyan-400"
    ];
    
    const colorIndex = (parseInt(speakerId.toString()) - 1) % colors.length;
    return colors[Math.max(0, colorIndex)];
  };
  
  if (!transcript) {
    return <div className="text-muted-foreground italic">No transcript available</div>;
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {segments.map((segment, index) => (
        <div key={index} className="transcript-segment">
          {segment.speaker && highlightSpeakers && (
            <div className={cn(
              "font-semibold mb-1",
              getSpeakerColor(segment.speaker)
            )}>
              {segment.speaker}
              {segment.timestamp && showTimestamps && (
                <span className="text-muted-foreground font-normal ml-2">
                  [{segment.timestamp}]
                </span>
              )}
            </div>
          )}
          
          <div className={cn(
            "whitespace-pre-wrap",
            !segment.speaker && segment.timestamp && showTimestamps && "pl-6 relative before:content-['[' attr(data-time) ']'] before:absolute before:left-0 before:text-muted-foreground before:font-mono"
          )}
          data-time={segment.timestamp}>
            {segment.text}
          </div>
        </div>
      ))}
    </div>
  );
};
