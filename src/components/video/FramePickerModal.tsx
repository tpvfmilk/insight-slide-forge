// At the top of the file, import our new hook and types
import { useChunkedVideoPlayer } from "@/hooks/useChunkedVideoPlayer";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RefreshCw, X, Trash2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface FramePickerModalProps {
  open: boolean;
  onClose: () => void;
  videoPath?: string;
  projectId: string;
  onFramesSelected: (selectedFrames: ExtractedFrame[]) => void;
  allExtractedFrames?: ExtractedFrame[];
  existingFrames?: ExtractedFrame[];
  hasChunkedVideo?: boolean;
}

export function FramePickerModal({
  open,
  onClose,
  videoPath,
  projectId,
  onFramesSelected,
  allExtractedFrames = [],
  existingFrames = [],
  hasChunkedVideo = false
}: FramePickerModalProps) {
  // Get metadata for the project to extract chunk information
  const [project, setProject] = useState<Project | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [frameToDelete, setFrameToDelete] = useState<ExtractedFrame | null>(null);
  const [selectedFramesForDeletion, setSelectedFramesForDeletion] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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

  // Handle frame capture with the useFrameCapture hook
  const handleFrameCaptured = (frame: ExtractedFrame) => {
    frameLibraryHook.addFrameToLibrary(frame);
  };

  const frameCaptureHook = useFrameCapture({
    videoRef,
    projectId,
    videoUrl,
    duration,
    formatTime,
    onFrameCaptured: handleFrameCaptured,
    allExtractedFrames
  });

  // Use the frame library hook with the correct props
  const frameLibraryHook = useFrameLibrary({
    projectId,
    existingFrames,
    allExtractedFrames,
    onFramesSelected
  });
  
  // Handle frame deletion
  const handleFrameDelete = (e: React.MouseEvent, frame: ExtractedFrame) => {
    e.stopPropagation(); // Prevent triggering frame selection
    setFrameToDelete(frame);
    setShowDeleteConfirm(true);
  };
  
  // Confirm delete a single frame
  const confirmDeleteFrame = () => {
    if (frameToDelete && frameToDelete.id) {
      frameLibraryHook.removeFrame(frameToDelete.id);
      toast.success("Frame deleted successfully");
    }
    setShowDeleteConfirm(false);
    setFrameToDelete(null);
  };
  
  // Toggle selection for bulk deletion
  const toggleFrameForBulkDeletion = (e: React.MouseEvent, frameId: string) => {
    e.stopPropagation(); // Prevent other click handlers
    setSelectedFramesForDeletion(prev => {
      if (prev.includes(frameId)) {
        return prev.filter(id => id !== frameId);
      } else {
        return [...prev, frameId];
      }
    });
  };
  
  // Delete multiple selected frames
  const confirmBulkDelete = async () => {
    if (selectedFramesForDeletion.length === 0) return;
    
    try {
      await frameLibraryHook.deleteMultipleFrames(selectedFramesForDeletion);
      toast.success(`Deleted ${selectedFramesForDeletion.length} frames successfully`);
      setSelectedFramesForDeletion([]);
    } catch (error) {
      toast.error("Failed to delete selected frames");
      console.error(error);
    } finally {
      setShowBulkDeleteConfirm(false);
    }
  };

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
                    capturedTimemarks={frameCaptureHook.capturedTimemarks}
                    chunkTimemarks={chunkTimemarks} 
                    isCapturingFrame={frameCaptureHook.isCapturingFrame}
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
                    onCaptureFrame={frameCaptureHook.captureFrame}
                    getChunkInfoAtTime={getChunkInfoForTime}
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
                value={frameLibraryHook.searchTerm}
                onChange={frameLibraryHook.handleSearchChange}
              />
              <Button variant="ghost" size="sm" onClick={frameLibraryHook.clearSearch}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Bulk Actions */}
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">
                {selectedFramesForDeletion.length > 0 ? 
                  `${selectedFramesForDeletion.length} frame(s) selected for deletion` : 
                  `${frameLibraryHook.libraryFrames.length} frame(s) available`}
              </div>
              {selectedFramesForDeletion.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Selected
                </Button>
              )}
            </div>

            {/* Frame Library */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="rounded-md border h-full">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-2">
                  {frameLibraryHook.libraryFrames.map((frame) => (
                    <div key={frame.id} className="relative">
                      <AspectRatio ratio={16 / 9}>
                        <img
                          src={frame.imageUrl}
                          alt={`Frame at ${frame.timestamp}`}
                          className="object-cover rounded-md cursor-pointer"
                        />
                      </AspectRatio>
                      
                      <div className="absolute top-1 right-1 flex items-center space-x-1">
                        {/* Checkbox for bulk deletion */}
                        <div 
                          className={cn(
                            "h-5 w-5 rounded flex items-center justify-center bg-background/80",
                            selectedFramesForDeletion.includes(frame.id!) ? "border-primary" : "border"
                          )}
                          onClick={(e) => toggleFrameForBulkDeletion(e, frame.id!)}
                        >
                          <Checkbox 
                            checked={selectedFramesForDeletion.includes(frame.id!)} 
                            onCheckedChange={() => {}} 
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                        
                        {/* Delete button */}
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="h-5 w-5 rounded-full"
                          onClick={(e) => handleFrameDelete(e, frame)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <Label
                        htmlFor={frame.id}
                        className="absolute inset-0 flex items-start justify-end p-2 cursor-pointer"
                      >
                        <Checkbox
                          id={frame.id}
                          checked={frameLibraryHook.isFrameSelected(frame)}
                          onCheckedChange={() => frameLibraryHook.toggleFrameSelection(frame)}
                          className="border-primary ring-offset-background focus-visible:ring-ring"
                        />
                      </Label>
                      
                      {/* Frame timestamp badge */}
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                        {frame.timestamp}
                      </div>
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
            onClick={frameLibraryHook.applySelectedFrames}
            disabled={frameLibraryHook.selectedFramesCount === 0}
          >
            Apply Selected Frames
          </Button>
        </div>
      </DialogContent>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Frame</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this frame? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteFrame}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Frames</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedFramesForDeletion.length} selected frames? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedFramesForDeletion.length} Frames
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
