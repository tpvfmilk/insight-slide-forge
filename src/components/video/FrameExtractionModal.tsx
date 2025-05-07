
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";
import { uploadSlideImage } from "@/services/imageService";
import { RefreshCw, Check, X, Image, AlertTriangle, Play, PauseIcon, SkipForward } from "lucide-react";

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
  const [extractedFrames, setExtractedFrames] = useState<Array<{ timestamp: string, frame: Blob, previewUrl?: string, status: 'success' | 'error' | 'pending' }>>([]);
  const [uploadedFrames, setUploadedFrames] = useState<Array<{ timestamp: string, imageUrl: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Step 1: Load the video when the component mounts
  useEffect(() => {
    const loadVideo = async () => {
      if (!open || !videoPath) return;
      
      try {
        setError(null);
        setVideoReady(false);
        // Generate the signed URL for the video
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.storage
          .from('video_uploads')
          .createSignedUrl(videoPath, 3600, {
            download: false, // We need to stream, not download
            transform: {
              width: 1280, // Reasonable size limit to improve performance
            }
          });
          
        if (error || !data?.signedUrl) {
          console.error("Error getting video signed URL:", error);
          setError("Could not access the video. Please check permissions.");
          return;
        }
        
        // Add a cache-busting parameter to prevent caching issues
        const videoUrlWithCache = new URL(data.signedUrl);
        videoUrlWithCache.searchParams.append('_cache', Date.now().toString());
        
        setVideoUrl(videoUrlWithCache.toString());
        console.log("Successfully loaded video with secure URL");
      } catch (error) {
        console.error("Error loading video:", error);
        setError(`Failed to load video: ${(error as Error).message}`);
        toast.error("Failed to load video");
      }
    };
    
    loadVideo();
  }, [open, videoPath]);
  
  // Handle video loaded data event
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoReady(true);
        console.log(`Video ready. Dimensions: ${video.videoWidth}x${video.videoHeight}, Duration: ${video.duration}s`);
        // Preload by seeking to the first timestamp to warm up the video
        if (timestamps.length > 0) {
          try {
            const firstSeconds = timestamps[0].split(':').reduce((acc, time) => (60 * acc) + +time, 0);
            video.currentTime = Math.min(firstSeconds, Math.floor(video.duration - 1));
          } catch (e) {
            console.warn("Failed to seek to first timestamp", e);
          }
        }
      }
    }
  };
  
  // Extract frames from the video
  const startExtraction = async () => {
    if (!videoUrl || timestamps.length === 0) {
      toast.error("Video URL or timestamps are missing");
      return;
    }
    
    if (!videoReady) {
      toast.error("Video is not ready for frame extraction yet");
      return;
    }
    
    setIsExtracting(true);
    setProgress(0);
    setExtractedFrames([]);
    setUploadedFrames([]);
    setError(null);
    
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
        return { timestamp, frame, previewUrl, status: 'success' as const };
      });
      
      setExtractedFrames(framesWithPreviews);
      toast.success(`Extracted ${frames.length} frames`, { id: "extract-frames" });
      
      // Start uploading the frames if we have any
      if (frames.length > 0) {
        await uploadFrames(framesWithPreviews);
      } else {
        toast.error("No frames were successfully extracted", { id: "extract-frames" });
        setError("No frames could be extracted. Please try again or check the video format.");
      }
    } catch (error) {
      console.error("Error extracting frames:", error);
      setError(`Frame extraction failed: ${(error as Error).message}`);
      toast.error(`Frame extraction failed: ${(error as Error).message}`, { id: "extract-frames" });
    } finally {
      setIsExtracting(false);
    }
  };
  
  // Upload the extracted frames
  const uploadFrames = async (frames: Array<{ timestamp: string, frame: Blob, previewUrl?: string, status: 'success' | 'error' | 'pending' }>) => {
    if (frames.length === 0) {
      return;
    }
    
    toast.loading("Uploading extracted frames...", { id: "upload-frames" });
    setProgress(0);
    setError(null);
    
    try {
      const uploadedResults: Array<{ timestamp: string, imageUrl: string }> = [];
      
      for (let i = 0; i < frames.length; i++) {
        const { timestamp, frame } = frames[i];
        
        try {
          // Create a file from the blob
          const file = new File([frame], `frame-${timestamp.replace(/:/g, '-')}-${projectId}.jpg`, { type: 'image/jpeg' });
          
          // Upload the file
          const uploadResult = await uploadSlideImage(file);
          
          if (uploadResult) {
            uploadedResults.push({
              timestamp,
              imageUrl: uploadResult.url
            });
            
            // Update the status of this frame
            setExtractedFrames(prev => 
              prev.map(f => 
                f.timestamp === timestamp 
                  ? { ...f, status: 'success' as const } 
                  : f
              )
            );
          } else {
            console.error(`Failed to upload frame at timestamp ${timestamp}`);
            
            // Update the status of this frame
            setExtractedFrames(prev => 
              prev.map(f => 
                f.timestamp === timestamp 
                  ? { ...f, status: 'error' as const } 
                  : f
              )
            );
          }
        } catch (uploadError) {
          console.error(`Error uploading frame at timestamp ${timestamp}:`, uploadError);
          // Update the status of this frame
          setExtractedFrames(prev => 
            prev.map(f => 
              f.timestamp === timestamp 
                ? { ...f, status: 'error' as const } 
                : f
            )
          );
        }
        
        // Update progress
        const progressPercentage = Math.floor(((i + 1) / frames.length) * 100);
        setProgress(progressPercentage);
      }
      
      if (uploadedResults.length === 0) {
        setError("Failed to upload any frames. Please try again.");
        toast.error("Frame upload failed", { id: "upload-frames" });
        return;
      }
      
      setUploadedFrames(uploadedResults);
      toast.success(`Uploaded ${uploadedResults.length} frames`, { id: "upload-frames" });
      
      // Call the completion handler with the uploaded frames
      if (uploadedResults.length > 0) {
        onComplete(uploadedResults);
      }
    } catch (error) {
      console.error("Error uploading frames:", error);
      setError(`Frame upload failed: ${(error as Error).message}`);
      toast.error(`Frame upload failed: ${(error as Error).message}`, { id: "upload-frames" });
    }
  };
  
  // Retry extraction for a specific timestamp
  const retryFrame = async (timestamp: string) => {
    if (!videoUrl || !videoReady) {
      toast.error("Video is not ready");
      return;
    }
    
    try {
      setExtractedFrames(prev => 
        prev.map(f => 
          f.timestamp === timestamp 
            ? { ...f, status: 'pending' as const } 
            : f
        )
      );
      
      toast.loading(`Retrying frame at ${timestamp}...`, { id: "retry-frame" });
      
      // Extract single frame
      const frames = await extractFramesFromVideoUrl(videoUrl, [timestamp]);
      
      if (frames.length > 0) {
        const frame = frames[0];
        const previewUrl = URL.createObjectURL(frame.frame);
        
        // Update the frame in the state
        setExtractedFrames(prev => 
          prev.map(f => 
            f.timestamp === timestamp 
              ? { timestamp, frame: frame.frame, previewUrl, status: 'success' as const } 
              : f
          )
        );
        
        // Upload the frame
        const file = new File([frame.frame], `frame-${timestamp.replace(/:/g, '-')}-${projectId}.jpg`, { type: 'image/jpeg' });
        const uploadResult = await uploadSlideImage(file);
        
        if (uploadResult) {
          // Add to uploaded frames
          setUploadedFrames(prev => {
            const filteredPrev = prev.filter(f => f.timestamp !== timestamp);
            return [...filteredPrev, { timestamp, imageUrl: uploadResult.url }];
          });
          
          toast.success(`Successfully extracted and uploaded frame at ${timestamp}`, { id: "retry-frame" });
        } else {
          toast.error(`Failed to upload frame at ${timestamp}`, { id: "retry-frame" });
        }
      } else {
        toast.error(`Failed to extract frame at ${timestamp}`, { id: "retry-frame" });
      }
    } catch (error) {
      console.error(`Error retrying frame at ${timestamp}:`, error);
      toast.error(`Retry failed: ${(error as Error).message}`, { id: "retry-frame" });
      
      // Update the status to error
      setExtractedFrames(prev => 
        prev.map(f => 
          f.timestamp === timestamp 
            ? { ...f, status: 'error' as const } 
            : f
        )
      );
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
  
  // Handle video loading error
  const handleVideoError = () => {
    if (videoRef.current) {
      const videoError = videoRef.current.error;
      let errorMessage = "Unknown error";
      
      if (videoError) {
        errorMessage = `${videoError.message} (code: ${videoError.code})`;
        // Log detailed error information
        console.error("Video error details:", {
          code: videoError.code,
          message: videoError.message,
          MEDIA_ERR_ABORTED: videoError.MEDIA_ERR_ABORTED,
          MEDIA_ERR_NETWORK: videoError.MEDIA_ERR_NETWORK,
          MEDIA_ERR_DECODE: videoError.MEDIA_ERR_DECODE,
          MEDIA_ERR_SRC_NOT_SUPPORTED: videoError.MEDIA_ERR_SRC_NOT_SUPPORTED
        });
      }
      
      setError(`Video failed to load: ${errorMessage}`);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extract Video Frames</DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-6">
          {/* Error Message with enhanced troubleshooting info */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Error</p>
                <p>{error}</p>
                <p className="mt-2">
                  Common issues:
                  <ul className="list-disc list-inside ml-2 mt-1">
                    <li>Browser security restrictions for video access</li>
                    <li>Video storage bucket permissions (make sure video_uploads bucket is public)</li>
                    <li>Network connectivity issues</li>
                    <li>Format not supported by your browser</li>
                    <li>CORS configuration preventing video access</li>
                  </ul>
                </p>
                <p className="mt-1 text-xs">
                  Troubleshooting: Try refreshing the page or uploading the video in a different format.
                </p>
              </div>
            </div>
          )}
          
          {/* Video Preview */}
          {videoUrl && (
            <div className="aspect-video bg-black rounded-md overflow-hidden">
              <video 
                ref={videoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                controls
                preload="auto"
                className="w-full h-full object-contain"
                onError={handleVideoError}
                onLoadedData={handleVideoLoaded}
              />
            </div>
          )}
          
          {/* Video Readiness Indicator */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              <p>Ready to extract {timestamps.length} frames from video</p>
              <p className="mt-1">Frames will be saved for each timestamp in your slides</p>
            </div>
            <div className={`flex items-center gap-2 ${videoReady ? 'text-green-500' : 'text-amber-500'}`}>
              {videoReady ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">Video ready</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Preparing video...</span>
                </>
              )}
            </div>
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
                    {frame.previewUrl ? (
                      <img 
                        src={frame.previewUrl} 
                        alt={`Frame at ${frame.timestamp}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1">
                      {frame.timestamp}
                    </div>
                    
                    {frame.status === 'success' && uploadedFrames.some(f => f.timestamp === frame.timestamp) && (
                      <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    
                    {frame.status === 'error' && (
                      <div className="absolute top-1 right-1 flex gap-1">
                        <Button 
                          size="icon" 
                          variant="destructive" 
                          className="h-6 w-6 rounded-full"
                          onClick={() => retryFrame(frame.timestamp)}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    
                    {frame.status === 'pending' && (
                      <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-1">
                        <RefreshCw className="h-3 w-3 text-white animate-spin" />
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
              <Button onClick={startExtraction} disabled={isExtracting || !videoUrl || !videoReady}>
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
