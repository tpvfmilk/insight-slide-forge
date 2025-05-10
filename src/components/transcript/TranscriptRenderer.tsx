
import { useEffect, useState } from "react";
import { hasMultipleVideoSections } from "@/utils/transcriptUtils";

interface Props {
  transcript: string;
  showTimestamps?: boolean;
  highlightSpeakers?: boolean;
  showVideoSeparators?: boolean;
}

export const TranscriptRenderer: React.FC<Props> = ({ 
  transcript, 
  showTimestamps = true,
  highlightSpeakers = true,
  showVideoSeparators = true 
}) => {
  const [formattedText, setFormattedText] = useState<React.ReactNode[]>([]);
  
  useEffect(() => {
    if (!transcript) {
      setFormattedText([]);
      return;
    }
    
    const hasMultipleVideos = hasMultipleVideoSections(transcript);
    
    // Split the transcript by lines
    const lines = transcript.split('\n');
    const result: React.ReactNode[] = [];
    
    let currentVideoSection: string | null = null;
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a video section header
      const isVideoHeader = /^\s*#{1,3}\s+.+$/.test(line);
      
      if (isVideoHeader && hasMultipleVideos) {
        currentVideoSection = line.replace(/^#+\s+/, '').trim();
        
        if (showVideoSeparators) {
          // Add a video section header
          result.push(
            <div 
              key={`video-${i}`}
              className="my-4 py-2 px-3 bg-primary/10 border-l-4 border-primary rounded-sm font-medium"
            >
              {currentVideoSection}
            </div>
          );
        }
        continue;
      }
      
      // Skip empty lines
      if (!line.trim()) {
        result.push(<div key={`empty-${i}`} className="my-2"></div>);
        continue;
      }
      
      // Check for timestamp markers [00:00]
      const timestampMatch = line.match(/\[(\d+:\d+)\]/);
      const hasSpeaker = /^Speaker\s+\d+:/.test(line);
      
      // Determine styles based on content
      const className = hasSpeaker && highlightSpeakers
        ? "p-1 my-1 rounded-sm bg-muted/40" 
        : "p-1 my-1";
      
      if (timestampMatch && showTimestamps) {
        const timestamp = timestampMatch[1];
        const beforeTimestamp = line.substring(0, timestampMatch.index);
        const afterTimestamp = line.substring(timestampMatch.index! + timestampMatch[0].length);
        
        // Add the line with formatted timestamp
        result.push(
          <div key={`line-${i}`} className={className}>
            {beforeTimestamp}
            <span className="text-primary-500 font-mono text-xs bg-primary-50 px-1 py-0.5 rounded mx-0.5">
              {timestamp}
            </span>
            {afterTimestamp}
          </div>
        );
      } else if (!showTimestamps && timestampMatch) {
        // Remove timestamp if not showing timestamps
        const textWithoutTimestamp = line.replace(/\[\d+:\d+\]\s*/, '');
        result.push(<div key={`line-${i}`} className={className}>{textWithoutTimestamp}</div>);
      } else {
        // Add the line as is
        result.push(<div key={`line-${i}`} className={className}>{line}</div>);
      }
    }
    
    setFormattedText(result);
  }, [transcript, showTimestamps, highlightSpeakers, showVideoSeparators]);
  
  return (
    <div className="transcript-renderer text-sm">
      {formattedText}
    </div>
  );
};
