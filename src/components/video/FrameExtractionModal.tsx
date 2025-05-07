
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";
import { uploadSlideImage } from "@/services/imageService";
import { RefreshCw, Check, X, Image } from "lucide-react";

interface FrameExtractionModalProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  projectId: string;
  timestamps: string[];
  onComplete: (frameUrls: Array<{ timestamp: string, imageUrl: string }>) => void;
}

export const FrameExtractionModal = ({
  open,
  onClose,
  videoPath,
  projectId,
  timestamps,
  onComplete
}: FrameExtractionModalProps) => {
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [extractedFrames, setExtractedFrames] = useState<Array<{ timestamp: string, frame: Blob, previewUrl?: string }>>([]);
  const [uploadedFrames, setUploadedFrames] = useState<Array<{ timestamp: string, imageUrl: string }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Step 1: Load the video when the component mounts
  useEffect(() => {
    const loadVideo = async () => {
      if (!open || !videoPath) return;
      
      try {
        // Generate the public URL for the video
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = supabase.storage.from('video_uploads').getPublicUrl(videoPath);
        setVideoUrl(data.publicUrl);
      } catch (error) {
        console.error("Error loading video:", error);
        toast.error("Failed to load video");
        onClose();
      }
    };
    
    loadVideo();
  }, [open, videoPath]);
  
  // Extract frames from the video
  const startExtraction = async () => {
    if (!videoUrl || timestamps.length === 0) {
      toast.error("Video URL or timestamps are missing");
      return;
    }
    
    setIsExtracting(true);
    setProgress(0);
    setExtractedFrames([]);
    setUploadedFrames([]);
    
    try {
      toast.loading("Extracting frames from video...", { id: "extract-frames" });
      
      // Start the extraction process
      const frames = await extractFramesFromVideoUrl(
        videoUrl,
        timestamps,
        (completed, total) => {
          // Update progress
          const progressPercentage = Math.floor((completed / total) * 100);
          setProgress(progressPercentage);
        }
      );
      
      // Generate preview URLs for the extracted frames
      const framesWithPreviews = frames.map(({ timestamp, frame }) => {
        const previewUrl = URL.createObjectURL(frame);
        return { timestamp, frame, previewUrl };
      });
      
      setExtractedFrames(framesWithPreviews);
      toast.success(`Extracted ${frames.length} frames`, { id: "extract-frames" });
      
      // Start uploading the frames
      await uploadFrames(framesWithPreviews);
    } catch (error) {
      console.error("Error extracting frames:", error);
      toast.error(`Frame extraction failed: ${error.message}`, { id: "extract-frames" });
    } finally {
      setIsExtracting(false);
    }
  };
  
  // Upload the extracted frames
  const uploadFrames = async (frames: Array<{ timestamp: string, frame: Blob, previewUrl?: string }>) => {
    if (frames.length === 0) {
      return;
    }
    
    toast.loading("Uploading extracted frames...", { id: "upload-frames" });
    setProgress(0);
    
    try {
      const uploadedResults: Array<{ timestamp: string, imageUrl: string }> = [];
      
      for (let i = 0; i < frames.length; i++) {
        const { timestamp, frame } = frames[i];
        
        // Create a file from the blob
        const file = new File([frame], `frame-${timestamp.replace(/:/g, '-')}.jpg`, { type: 'image/jpeg' });
        
        // Upload the file
        const uploadResult = await uploadSlideImage(file);
        
        if (uploadResult) {
          uploadedResults.push({
            timestamp,
            imageUrl: uploadResult.url
          });
        }
        
        // Update progress
        const progressPercentage = Math.floor(((i + 1) / frames.length) * 100);
        setProgress(progressPercentage);
      }
      
      setUploadedFrames(uploadedResults);
      toast.success(`Uploaded ${uploadedResults.length} frames`, { id: "upload-frames" });
      
      // Call the completion handler with the uploaded frames
      onComplete(uploadedResults);
    } catch (error) {
      console.error("Error uploading frames:", error);
      toast.error(`Frame upload failed: ${error.message}`, { id: "upload-frames" });
    }
  };
  
  // Clean up URL objects when the component is unmounted
  useEffect(() => {
    return () => {
      extractedFrames.forEach(frame => {
        if (frame.previewUrl) {
          URL.revokeObjectURL(frame.previewUrl);
        }
      });
    };
  }, [extractedFrames]);
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extract Video Frames</DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-6">
          {/* Video Preview */}
          {videoUrl && (
            <div className="aspect-video bg-black rounded-md overflow-hidden">
              <video 
                ref={videoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                controls
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          
          {/* Extraction Info */}
          <div className="text-sm text-muted-foreground">
            <p>Ready to extract {timestamps.length} frames from video</p>
            <p className="mt-1">Frames will be saved for each timestamp in your slides</p>
          </div>
          
          {/* Progress Indicator */}
          {isExtracting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Extracting frames...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          
          {/* Extracted Frames Preview */}
          {extractedFrames.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Extracted Frames</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {extractedFrames.map((frame, index) => (
                  <div key={index} className="aspect-video bg-muted rounded overflow-hidden relative">
                    {frame.previewUrl && (
                      <img 
                        src={frame.previewUrl} 
                        alt={`Frame at ${frame.timestamp}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1">
                      {frame.timestamp}
                    </div>
                    
                    {uploadedFrames.some(f => f.timestamp === frame.timestamp) && (
                      <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose} disabled={isExtracting}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            
            {extractedFrames.length === 0 ? (
              <Button onClick={startExtraction} disabled={isExtracting || !videoUrl}>
                {isExtracting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Image className="h-4 w-4 mr-1" />
                    Extract Frames
                  </>
                )}
              </Button>
            ) : uploadedFrames.length > 0 ? (
              <Button onClick={() => onComplete(uploadedFrames)}>
                <Check className="h-4 w-4 mr-1" />
                Apply Frames to Slides
              </Button>
            ) : (
              <Button onClick={() => uploadFrames(extractedFrames)} disabled={isExtracting}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Upload Frames
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
