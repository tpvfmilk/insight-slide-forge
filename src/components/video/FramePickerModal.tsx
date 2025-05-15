// At the top of the file, import our new hook and types
import { useChunkedVideoPlayer } from "@/hooks/useChunkedVideoPlayer";
import { getChunkTimemarksFromProject } from "@/services/videoChunkingService";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Project } from "@/services/projectService";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { useFrameCapture } from "@/hooks/useFrameCapture";
import { useFrameLibrary } from "@/hooks/useFrameLibrary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FramePickerModalProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  projectId: string;
  onFramesSelected: (frames: ExtractedFrame[]) => void;
  allExtractedFrames: ExtractedFrame[];
  existingFrames: ExtractedFrame[];
}

export const FramePickerModal: React.FC<FramePickerModalProps> = ({
  open,
  onClose,
  videoPath,
  projectId,
  onFramesSelected,
  allExtractedFrames,
  existingFrames
}) => {
  // Get metadata for the project to extract chunk information
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    // Fetch project data to get metadata including chunking info
    const fetchProject = async () => {
      if (projectId) {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
          
        if (!error && data) {
          setProject(data as Project);
        }
      }
    };
    
    fetchProject();
  }, [projectId]);

  // Use our enhanced video player hook
  const {
    videoRef,
    videoUrl,
    isPlaying,
    currentTime,
    duration,
    seekingValue,
    isVideoLoaded,
    isLoadingVideo,
    videoError,
    formatTime,
    togglePlayPause,
    seekBack,
    seekForward,
    handleSeekStart,
    handleSeekChange,
    handleSeekEnd,
    retryLoadVideo,
    handleVideoLoaded,
    handleVideoError,
    chunkTimemarks,
    getChunkInfoForTime
  } = useChunkedVideoPlayer({
    videoPath, 
    projectId,
    videoMetadata: project?.video_metadata
  });

  const {
    capturedFrameTimemarks,
    isCapturing,
    handleCaptureFrame
  } = useFrameCapture(videoRef);

  const {
    frameLibrary,
    selectedFrames,
    searchTerm,
    isFrameSelected,
    handleFrameSelect,
    handleSearchChange,
    clearSearch,
    applySelectedFrames
  } = useFrameLibrary({
    allExtractedFrames,
    existingFrames,
    onFramesSelected,
    onClose
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90%] w-[90%] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Frame Selection</DialogTitle>
          <DialogDescription>
            Select frames from the video to use in your slides.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Video Player Section */}
          <div className="col-span-1">
            <div className="relative">
              <AspectRatio ratio={16 / 9}>
                {isLoadingVideo ? (
                  <Skeleton className="w-full h-full" />
                ) : (
                  <VideoPlayer
                    videoRef={videoRef}
                    videoUrl={videoUrl}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    seekingValue={seekingValue}
                    isVideoLoaded={isVideoLoaded}
                    isLoadingVideo={isLoadingVideo}
                    videoError={videoError}
                    capturedTimemarks={capturedFrameTimemarks}
                    chunkTimemarks={chunkTimemarks} // Add chunk timemarks here
                    isCapturingFrame={isCapturing}
                    formatTime={formatTime}
                    togglePlayPause={togglePlayPause}
                    seekBack={seekBack}
                    seekForward={seekForward}
                    handleSeekStart={handleSeekStart}
                    handleSeekChange={handleSeekChange}
                    handleSeekEnd={handleSeekEnd}
                    retryLoadVideo={retryLoadVideo}
                    handleVideoLoaded={handleVideoLoaded}
                    handleVideoError={handleVideoError}
                    onCaptureFrame={handleCaptureFrame}
                    getChunkInfoAtTime={getChunkInfoForTime} // Add info getter here
                  />
                )}
              </AspectRatio>
            </div>
          </div>

          {/* Frame Library Section */}
          <div className="col-span-1 flex flex-col">
            {/* Search and Clear Input */}
            <div className="flex items-center space-x-2 mb-2">
              <Input
                type="text"
                placeholder="Search frames..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Frame Library */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="rounded-md border h-full">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-2">
                  {frameLibrary.map((frame) => (
                    <div key={frame.id} className="relative">
                      <AspectRatio ratio={16 / 9}>
                        <img
                          src={frame.imageUrl}
                          alt={`Frame at ${frame.timestamp}`}
                          className="object-cover rounded-md cursor-pointer"
                        />
                      </AspectRatio>
                      <Label
                        htmlFor={frame.id}
                        className="absolute inset-0 flex items-start justify-end p-2 cursor-pointer"
                      >
                        <Checkbox
                          id={frame.id}
                          checked={isFrameSelected(frame)}
                          onCheckedChange={() => handleFrameSelect(frame)}
                          className="border-primary ring-offset-background focus-visible:ring-ring"
                        />
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end mt-4 space-x-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={applySelectedFrames}
            disabled={selectedFrames.length === 0}
          >
            Apply Selected Frames
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
