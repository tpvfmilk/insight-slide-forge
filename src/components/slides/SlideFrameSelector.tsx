
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { FramePickerModal } from "@/components/video/FramePickerModal";
import { LocalExtractedFrame } from "@/hooks/useSlides";

interface SlideFrameSelectorProps {
  projectId?: string;
  videoPath: string;
  allExtractedFrames: LocalExtractedFrame[];
  currentSlide: {
    imageUrl?: string;
    imageUrls?: string[];
  };
  isFramePickerModalOpen: boolean;
  setIsFramePickerModalOpen: (isOpen: boolean) => void;
  onFramesSelected: (frames: ExtractedFrame[]) => Promise<void>;
  loadFramesFromProject: () => Promise<LocalExtractedFrame[]>;
}

export const SlideFrameSelector = ({
  projectId,
  videoPath,
  allExtractedFrames,
  currentSlide,
  isFramePickerModalOpen,
  setIsFramePickerModalOpen,
  onFramesSelected,
  loadFramesFromProject
}: SlideFrameSelectorProps) => {
  // Prepare existing frames for the FramePicker
  const getExistingSlideFrames = (): ExtractedFrame[] => {
    const existingFrameUrls = currentSlide.imageUrls || [];
    if (currentSlide.imageUrl && !existingFrameUrls.includes(currentSlide.imageUrl)) {
      existingFrameUrls.push(currentSlide.imageUrl);
    }
    
    return allExtractedFrames.filter(frame => 
      existingFrameUrls.includes(frame.imageUrl)
    );
  };
  
  // Handler for when frames are selected in the frame picker
  const handleFrameSelection = async (selectedFrames: ExtractedFrame[]) => {
    if (!selectedFrames) {
      toast.info("No frames were selected");
      return;
    }
    
    try {
      await onFramesSelected(selectedFrames);
      setIsFramePickerModalOpen(false);
    } catch (error) {
      console.error("Error handling frame selection:", error);
      toast.error("Failed to apply frames to slide");
    }
  };
  
  return (
    <>
      {/* Frame Picker Modal */}
      {isFramePickerModalOpen && videoPath && (
        <FramePickerModal
          open={isFramePickerModalOpen}
          onClose={() => {
            setIsFramePickerModalOpen(false);
            // Force reload frames after closing modal to ensure we have the latest
            loadFramesFromProject();
          }} 
          videoPath={videoPath}
          projectId={projectId || ""}
          onFramesSelected={handleFrameSelection}
          allExtractedFrames={allExtractedFrames || []}
          existingFrames={getExistingSlideFrames()}
        />
      )}
    </>
  );
};
