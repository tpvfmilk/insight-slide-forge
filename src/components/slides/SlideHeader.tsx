
import { Clock } from "lucide-react";
import { FileSizeBadge } from "@/components/projects/FileSizeBadge";

interface SlideHeaderProps {
  currentSlideIndex: number;
  slidesLength: number;
  currentSlideTimestamp?: string;
  projectId?: string;
}

export const SlideHeader = ({
  currentSlideIndex,
  slidesLength,
  currentSlideTimestamp,
  projectId
}: SlideHeaderProps) => {
  return (
    <div className="flex justify-between items-center h-14 p-4 border-b">
      <div className="text-sm text-muted-foreground flex items-center">
        <Clock className="h-4 w-4 mr-1" />
        <span>Slide {currentSlideIndex + 1} of {slidesLength}</span>
        {currentSlideTimestamp && <span className="ml-2">• Timestamp: {currentSlideTimestamp}</span>}
        <span className="ml-2">•</span>
        {projectId && <FileSizeBadge projectId={projectId} />}
      </div>
    </div>
  );
};
