
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";
import { uploadSlideImage } from "@/services/imageService";
import { RefreshCw, Check, X, Image, AlertTriangle, Play, PauseIcon, SkipForward } from "lucide-react";
import { timestampToSeconds } from "@/utils/formatUtils";
import { VideoDetailsCard } from "@/components/video/VideoDetailsCard";

// Define ExtractedFrame interface
export interface ExtractedFrame {
  timestamp: string;
  imageUrl: string;
  isPlaceholder?: boolean;
}

interface FrameExtractionModalProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  projectId: string;
  timestamps: string[];
  onComplete: (frameUrls: Array<{ timestamp: string, imageUrl: string }>) => void;
  videoMetadata?: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  };
  previouslyExtractedFrames?: ExtractedFrame[];
}

export const FrameExtractionModal = ({
  open,
  onClose,
  videoPath,
  projectId,
  timestamps,
  onComplete,
  videoMetadata,
  previouslyExtractedFrames = []
}: FrameExtractionModalProps) => {
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [extractedFrames, setExtractedFrames] = useState<Array<{ timestamp: string, frame: Blob, previewUrl?: string, status: 'success' | 'error' | 'pending' }>>([]);
  const [uploadedFrames, setUploadedFrames] = useState<Array<{ timestamp: string, imageUrl: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timestampDistribution, setTimestampDistribution] = useState<Array<{time: number, position: number}>>([]);
  
  // Step 1: Load the video when the component mounts
  useEffect(() => {
    const loadVideo = async () => {
      if (!open || !videoPath) return;
      
      try {
        setError(null);
        setVideoReady(false);
        
        // Generate the signed URL for the video - removing transformations
        const { supabase } = await import('@/integrations/supabase/client');
        
        // First try with 'video_uploads' bucket
        try {
          const { data, error } = await supabase.storage
            .from('video_uploads')
            .createSignedUrl(videoPath, 3600, {
              download: false // We need to stream, not download
            });
            
          if (error || !data?.signedUrl) {
            throw new Error(`Error from video_uploads bucket: ${error?.message}`);
          }
          
          // Add a cache-busting parameter to prevent caching issues
          const videoUrlWithCache = new URL(data.signedUrl);
          videoUrlWithCache.searchParams.append('_cache', Date.now().toString());
          
          setVideoUrl(videoUrlWithCache.toString());
          console.log("Successfully loaded video from video_uploads bucket");
          return;
        } catch (videoUploadsError) {
          console.warn("Failed to get video from video_uploads bucket, trying 'videos' bucket...");
          
          // Try with 'videos' bucket as alternative
          try {
            // Extract just the filename from the path
            const filename = videoPath.split('/').pop();
            if (!filename) {
              throw new Error("Invalid video path format");
            }
            
            const { data, error } = await supabase.storage
              .from('videos')
              .createSignedUrl(filename, 3600);
            
            if (error || !data?.signedUrl) {
              throw new Error(`Error from videos bucket: ${error?.message}`);
            }
            
            // Add a cache-busting parameter
            const videoUrlWithCache = new URL(data.signedUrl);
            videoUrlWithCache.searchParams.append('_cache', Date.now().toString());
            
            setVideoUrl(videoUrlWithCache.toString());
            console.log("Successfully loaded video from videos bucket");
            return;
          } catch (videosBucketError) {
            console.error("Error creating signed URL for video:", { 
              videoUploadsError, 
              videosBucketError 
            });
            
            // Try to check if the video exists in the database but with a different path
            const { data: projectData, error: projectPathError } = await supabase
              .from('projects')
              .select('source_url')
              .eq('id', projectId)
              .maybeSingle();
              
            if (projectPathError) {
              console.error("Error fetching project source URL:", projectPathError);
            }
            
            // If we have a source URL in the project, try that instead
            if (projectData?.source_url) {
              console.log("Found source URL in project, trying that instead:", projectData.source_url);
              setVideoUrl(projectData.source_url);
              return;
            }
            
            throw new Error("Failed to get video URL. Please check if the video file exists in storage.");
          }
        }
      } catch (error) {
        console.error("Error loading video:", error);
        setError(`Failed to load video: ${(error as Error).message}`);
        toast.error("Failed to load video");
      }
    };
    
    loadVideo();
  }, [open, videoPath, projectId]);
  
  // Generate timestamp distribution visualization when video is ready or timestamps change
  useEffect(() => {
    if (!videoDuration || !timestamps.length) return;
    
    // Convert timestamps to seconds and positions
    const distribution = timestamps.map(timestamp => {
      const seconds = timestampToSeconds(timestamp);
      // Calculate position as percentage of video duration
      const position = Math.min(100, Math.max(0, (seconds / videoDuration) * 100));
      return { time: seconds, position };
    });
    
    setTimestampDistribution(distribution);
  }, [videoDuration, timestamps]);
  
  // Filter out timestamps that exceed video duration
  const validTimestamps = timestamps.filter(timestamp => {
    if (!videoDuration) return true; // Keep all if we don't know duration yet
    const seconds = timestampToSeconds(timestamp);
    return seconds <= videoDuration;
  });
  
  // Handle video loaded data event
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoReady(true);
        setVideoDuration(Math.round(video.duration));
        
        console.log(`Video ready. Dimensions: ${video.videoWidth}x${video.videoHeight}, Duration: ${video.duration}s`);
        
        // Filter timestamps based on video duration
        const invalidTimestamps = timestamps.filter(timestamp => {
          const seconds = timestampToSeconds(timestamp);
          return seconds > Math.round(video.duration);
        });
        
        if (invalidTimestamps.length > 0) {
          console.warn(`Found ${invalidTimestamps.length} timestamps that exceed video duration:`, invalidTimestamps);
          toast.warning(`${invalidTimestamps.length} timestamp(s) exceed video duration and will be skipped`);
        }
        
        // Preload by seeking to the first timestamp to warm up the video
        if (validTimestamps.length > 0) {
          try {
            const firstSeconds = timestampToSeconds(validTimestamps[0]);
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
    if (!videoUrl || validTimestamps.length === 0) {
      toast.error(validTimestamps.length === 0 ? 
        "No valid timestamps to extract frames from" : 
        "Video URL is missing");
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
      
      // Sort timestamps chronologically to optimize seeking
      const sortedTimestamps = [...validTimestamps].sort((a, b) => 
        timestampToSeconds(a) - timestampToSeconds(b)
      );
      
      console.log(`Extracting frames at timestamps (sorted): ${sortedTimestamps.join(', ')}`);
      
      // Add debug info for each timestamp
      sortedTimestamps.forEach((timestamp, i) => {
        const seconds = timestampToSeconds(timestamp);
        const percentage = (seconds / videoDuration * 100).toFixed(1);
        console.log(`Timestamp ${i+1}: ${timestamp} (${seconds}s, ${percentage}% into video)`);
      });
      
      // Start the extraction process with only valid timestamps
      const frames = await extractFramesFromVideoUrl(
        videoUrl,
        sortedTimestamps,
        (completed, total) => {
          // Update progress
          const progressPercentage = Math.floor((completed / total) * 100);
          setProgress(progressPercentage);
        },
        videoDuration // Pass video duration for validation
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
  
  // Test seek to timestamp - useful for debugging
  const testSeekToTimestamp = (timestamp: string) => {
    if (!videoRef.current || !videoReady) {
      toast.error("Video is not ready");
      return;
    }
    
    const seconds = timestampToSeconds(timestamp);
    console.log(`Seeking to timestamp ${timestamp} (${seconds}s)`);
    
    videoRef.current.currentTime = seconds;
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
          {/* Video Details Card - Fixed prop passing to match the component's interface */}
          {videoMetadata && (
            <div className="mb-6">
              <VideoDetailsCard videoMetadata={videoMetadata} />
            </div>
          )}
          
          {/* Previously Extracted Frames */}
          {previouslyExtractedFrames && previouslyExtractedFrames.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Previously Extracted Frames</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {previouslyExtractedFrames.map((frame, index) => (
                  <div key={index} className="aspect-video bg-muted rounded overflow-hidden relative">
                    <img 
                      src={frame.imageUrl} 
                      alt={`Frame at ${frame.timestamp}`} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1">
                      {frame.timestamp}
                    </div>
                    {frame.isPlaceholder && (
                      <div className="absolute top-0 left-0 right-0 bg-amber-500/90 text-white text-xs p-1">
                        Placeholder
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Timestamp Distribution Visualization */}
          {timestampDistribution.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Timestamp Distribution</h3>
              <div className="w-full h-8 bg-muted rounded-md relative">
                {/* Video timeline */}
                <div className="absolute top-0 left-0 w-full h-full border border-muted-foreground/20 rounded-md"></div>
                
                {/* Timestamp markers */}
                {timestampDistribution.map((item, i) => (
                  <div 
                    key={i}
                    className="absolute top-0 h-full w-0.5 bg-primary hover:bg-primary-foreground cursor-pointer"
                    style={{ left: `${item.position}%` }}
                    title={`${item.time.toFixed(2)}s (${(item.position).toFixed(1)}%)`}
                    onClick={() => testSeekToTimestamp(timestamps[i])}
                  />
                ))}
                
                {/* Current video position marker if video is loaded */}
                {videoReady && videoDuration > 0 && videoRef.current && (
                  <div 
                    className="absolute top-0 h-full w-1 bg-red-500"
                    style={{ 
                      left: `${(videoRef.current.currentTime / videoDuration) * 100}%`,
                      transition: 'left 0.5s' 
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0:00</span>
                <span>{Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                <p>Click on a timestamp marker to test seeking to that position in the video.</p>
                <p className="mt-1">
                  {timestampDistribution.length} timestamps, ranging from {timestampDistribution[0]?.time.toFixed(1)}s
                  to {timestampDistribution[timestampDistribution.length - 1]?.time.toFixed(1)}s
                </p>
              </div>
            </div>
          )}
          
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
                    <li>Video file may have been moved or deleted</li>
                    <li>The file path might be incorrect</li>
                  </ul>
                </p>
                <p className="mt-1 text-xs">
                  Troubleshooting: Try using the manual frame picker instead, or uploading the video in a different format.
                </p>
              </div>
            </div>
          )}
          
          {/* Video Duration Warning */}
          {videoReady && videoDuration > 0 && timestamps.length !== validTimestamps.length && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
              <div className="text-sm">
                <p className="font-medium">Invalid Timestamps Detected</p>
                <p>
                  {timestamps.length - validTimestamps.length} timestamp(s) exceed the video duration of {videoDuration} seconds and will be skipped.
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
              <p>Ready to extract {validTimestamps.length} frames from video</p>
              <p className="mt-1">Frames will be saved for each valid timestamp in your slides</p>
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
