
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Play, RefreshCw } from 'lucide-react';
import { extractFramesFromVideoUrl as clientExtractFrames } from '@/utils/videoFrameExtractor';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { timestampToSeconds } from '@/utils/formatUtils';
import { supabase } from '@/integrations/supabase/client';

interface FrameExtractionModalProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  projectId: string;
  timestamps: string[];
  onComplete: (frames: Array<{ timestamp: string; imageUrl: string }>) => void;
  videoMetadata?: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  };
  previouslyExtractedFrames?: Array<{ timestamp: string; imageUrl: string }>;
}

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
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
  const [extractedFrames, setExtractedFrames] = useState<Array<{ timestamp: string; imageUrl: string }>>([]);
  const [currentStep, setCurrentStep] = useState<'preparation' | 'extraction' | 'review'>('preparation');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [validTimestamps, setValidTimestamps] = useState<string[]>(timestamps);
  const [invalidTimestamps, setInvalidTimestamps] = useState<string[]>([]);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(true);
  const [loadAttempts, setLoadAttempts] = useState<number>(0);

  // Function to validate timestamps against video duration
  const validateTimestamps = useCallback((timestamps: string[], videoDuration?: number) => {
    if (!videoDuration) return { valid: timestamps, invalid: [] };
    
    const valid: string[] = [];
    const invalid: string[] = [];
    
    timestamps.forEach(timestamp => {
      const seconds = timestampToSeconds(timestamp);
      if (seconds <= videoDuration) {
        valid.push(timestamp);
      } else {
        invalid.push(timestamp);
      }
    });
    
    return { valid, invalid };
  }, []);

  // Effect to load and validate against video metadata
  useEffect(() => {
    if (open && videoMetadata?.duration) {
      console.log(`Validating timestamps against video duration: ${videoMetadata.duration}s`);
      const { valid, invalid } = validateTimestamps(timestamps, videoMetadata.duration);
      
      if (invalid.length > 0) {
        console.log(`Found ${invalid.length} invalid timestamps that exceed video duration`);
        toast.warning(`${invalid.length} timestamp(s) exceed the video duration of ${Math.round(videoMetadata.duration)} seconds and will be skipped.`);
      }
      
      setValidTimestamps(valid);
      setInvalidTimestamps(invalid);
    }
  }, [open, timestamps, videoMetadata, validateTimestamps]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep('preparation');
      setIsExtracting(false);
      setProgress(0);
      setCurrentFrameIndex(0);
      setExtractedFrames([]);
      setVideoError(null);
      setVideoUrl(null);
      setIsLoadingVideo(true);
      setLoadAttempts(0);
      
      // Attempt to load the video when modal opens
      loadVideo();
    }
  }, [open]);

  // Function to get a signed URL for the video
  const loadVideo = async () => {
    if (!videoPath || !open) return;
    
    setIsLoadingVideo(true);
    setVideoError(null);
    
    try {
      // Try first with the direct path
      setVideoUrl(videoPath);
      
      // If this is a retry, we'll try to get a fresh signed URL
      if (loadAttempts > 0) {
        console.log("Retry attempt to load video with a fresh signed URL");
        
        // Try to get a fresh signed URL from 'video_uploads' bucket
        try {
          // Correctly import and use the supabase client
          
          // Check if path uses a full prefix or just a filename
          let bucket = 'video_uploads';
          let filePath = videoPath;
          
          // If path includes '/', extract the actual file path without bucket name
          if (videoPath.includes('/')) {
            const pathParts = videoPath.split('/');
            if (pathParts.length > 1) {
              filePath = pathParts.pop() || '';
              bucket = pathParts.join('/');
            }
          }
          
          console.log(`Trying to get signed URL for ${bucket}/${filePath}`);
          
          const { data: urlData, error: urlError } = await supabase
            .storage
            .from(bucket)
            .createSignedUrl(filePath, 3600); // 1 hour expiry
          
          if (urlError || !urlData?.signedUrl) {
            console.error("Error getting signed URL:", urlError);
            throw new Error("Couldn't create access link for video");
          }
          
          console.log("Successfully got new signed URL");
          setVideoUrl(urlData.signedUrl);
        } catch (signedUrlError) {
          console.error("Failed to get signed URL:", signedUrlError);
          
          // Try to check if we can get the source URL from the project
          try {
            // Correctly use the supabase client
            
            const { data: projectData } = await supabase
              .from('projects')
              .select('source_url')
              .eq('id', projectId)
              .single();
            
            if (projectData?.source_url) {
              console.log("Falling back to project source URL:", projectData.source_url);
              setVideoUrl(projectData.source_url);
            } else {
              throw new Error("No alternative video source found");
            }
          } catch (projectError) {
            console.error("Error getting project source:", projectError);
            throw new Error("All video loading attempts failed");
          }
        }
      }
    } catch (error) {
      console.error("Error loading video:", error);
      setVideoError("Failed to access video. The video might not be available or the format is not supported.");
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // Extract frames from video
  const handleExtractFrames = async () => {
    if (validTimestamps.length === 0) {
      toast.error("There are no valid timestamps to extract frames from.");
      return;
    }
    
    if (!videoUrl) {
      toast.error("Video not available. Please try reloading the page.");
      return;
    }
    
    setIsExtracting(true);
    setCurrentStep('extraction');
    setProgress(0);

    try {
      toast.loading("Extracting frames from video...", { id: "extracting-frames" });

      // Extract frames using the client-side utility
      const frames = await clientExtractFrames(
        videoUrl, 
        validTimestamps, 
        (current, total) => {
          const progressPercent = Math.round((current / total) * 100);
          setProgress(progressPercent);
        },
        videoMetadata?.duration // Pass video duration to validate timestamps
      );

      // If we successfully got frames, store them
      if (frames && frames.length > 0) {
        const framesWithUrls = frames.map(frameData => {
          const objectUrl = URL.createObjectURL(frameData.frame);
          return {
            timestamp: frameData.timestamp,
            imageUrl: objectUrl,
            id: `frame-${frameData.timestamp}`
          };
        });
        
        setExtractedFrames(framesWithUrls);
        setCurrentStep('review');
        toast.success(`Extracted ${framesWithUrls.length} frames successfully`, { id: "extracting-frames" });
      } else {
        throw new Error("No frames were extracted");
      }
    } catch (error) {
      console.error("Error extracting frames:", error);
      toast.error(`Failed to extract frames: ${error.message || "Unknown error"}`, { id: "extracting-frames" });
    } finally {
      setIsExtracting(false);
    }
  };

  // Go to next frame in review step
  const nextFrame = () => {
    if (currentFrameIndex < extractedFrames.length - 1) {
      setCurrentFrameIndex(currentFrameIndex + 1);
    }
  };

  // Go to previous frame in review step
  const prevFrame = () => {
    if (currentFrameIndex > 0) {
      setCurrentFrameIndex(currentFrameIndex - 1);
    }
  };

  // Complete frame extraction process
  const completeExtraction = () => {
    onComplete(extractedFrames);
  };

  const currentFrame = extractedFrames[currentFrameIndex];

  // Check if video element is available and update UI accordingly
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.target as HTMLVideoElement;
    setVideoInfo({
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight
    });
    
    // Re-validate timestamps with the actual video duration if needed
    if (video.duration && (!videoMetadata?.duration || Math.abs(video.duration - videoMetadata.duration) > 1)) {
      console.log(`Video element reports duration: ${video.duration}s, which differs from metadata: ${videoMetadata?.duration || 'unknown'}s`);
      const { valid, invalid } = validateTimestamps(timestamps, video.duration);
      
      if (invalid.length > 0) {
        console.log(`Found ${invalid.length} invalid timestamps that exceed actual video duration`);
        toast.warning(`${invalid.length} timestamp(s) exceed the video duration of ${Math.round(video.duration)} seconds and will be skipped.`);
      }
      
      setValidTimestamps(valid);
      setInvalidTimestamps(invalid);
    }
    
    setVideoError(null);
    setIsLoadingVideo(false);
  };

  const handleVideoError = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error("Video loading error:", event);
    setVideoError("Failed to load video. The video might not be accessible or the format is not supported.");
    setIsLoadingVideo(false);
    
    // If we've tried less than 3 times, attempt to reload with a fresh URL
    if (loadAttempts < 3) {
      const nextAttempt = loadAttempts + 1;
      setLoadAttempts(nextAttempt);
      console.log(`Video load attempt ${nextAttempt} failed, trying again...`);
      
      // Wait a moment before trying again
      setTimeout(() => {
        loadVideo();
      }, 1000);
    }
  };

  const retryVideoLoad = () => {
    setLoadAttempts(loadAttempts + 1);
    loadVideo();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'preparation' && "Prepare Frame Extraction"}
            {currentStep === 'extraction' && "Extracting Frames"}
            {currentStep === 'review' && "Review Extracted Frames"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* Preparation Step */}
          {currentStep === 'preparation' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 max-h-[400px]">
                <div className="w-full sm:w-1/2 overflow-hidden h-64 sm:h-auto relative">
                  {isLoadingVideo ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <RefreshCw className="h-8 w-8 animate-spin text-white/70" />
                      <span className="ml-2 text-white/70">Loading video...</span>
                    </div>
                  ) : videoError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                      <AlertCircle className="h-10 w-10 text-destructive mb-2" />
                      <p className="text-white/90 text-center px-4">{videoError}</p>
                      <Button 
                        variant="outline" 
                        className="mt-4 bg-white/10 hover:bg-white/20 border-white/30 text-white"
                        onClick={retryVideoLoad}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Loading Video
                      </Button>
                    </div>
                  ) : (
                    <video 
                      key={`video-${loadAttempts}`} // Force remount on retry
                      src={videoUrl || undefined}
                      controls
                      className="w-full h-full object-contain bg-black"
                      onLoadedMetadata={handleVideoLoad}
                      onLoadedData={handleVideoLoad}
                      onError={handleVideoError}
                      crossOrigin="anonymous"
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
                <div className="w-full sm:w-1/2 overflow-y-auto">
                  <h3 className="text-lg font-medium mb-2">Timestamps to Extract</h3>
                  
                  {invalidTimestamps.length > 0 && (
                    <Alert variant="warning" className="mb-3 bg-yellow-50 text-yellow-800 border-yellow-200">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription>
                        <strong>{invalidTimestamps.length} invalid timestamp(s)</strong> exceed the video duration and will be skipped.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {validTimestamps.length === 0 && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No valid timestamps found. Please generate new slides with timestamps within the video duration of {videoMetadata?.duration ? Math.round(videoMetadata.duration) : 'unknown'} seconds.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {videoInfo && (
                    <div className="text-sm text-muted-foreground mb-3">
                      <span>Video Duration: {Math.floor(videoInfo.duration / 60)}:{Math.floor(videoInfo.duration % 60).toString().padStart(2, '0')}</span>
                      <span className="ml-3">Resolution: {videoInfo.width}x{videoInfo.height}</span>
                    </div>
                  )}
                  
                  {videoError && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{videoError}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {validTimestamps.map((timestamp, index) => (
                      <div 
                        key={`timestamp-${index}`}
                        className="border rounded p-2 text-center text-sm bg-secondary/50"
                      >
                        {timestamp}
                      </div>
                    ))}
                  </div>
                  
                  {invalidTimestamps.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-md font-medium mb-2 text-muted-foreground">Invalid Timestamps</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {invalidTimestamps.map((timestamp, index) => (
                          <div 
                            key={`invalid-timestamp-${index}`}
                            className="border border-destructive/50 rounded p-2 text-center text-sm bg-destructive/10"
                          >
                            {timestamp}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {previouslyExtractedFrames.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-md font-medium mb-2 text-muted-foreground">Previously Extracted</h4>
                      <div className="text-sm text-muted-foreground mb-2">
                        {previouslyExtractedFrames.length} frames were already extracted previously.
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleExtractFrames} 
                  disabled={validTimestamps.length === 0 || isExtracting || !!videoError || isLoadingVideo}
                  className="w-full sm:w-auto"
                >
                  {isExtracting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Frame Extraction
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Extraction Step */}
          {currentStep === 'extraction' && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-medium">Extracting Frames</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Processing {validTimestamps.length} timestamps...
                </p>
              </div>
              
              <Progress value={progress} className="h-2" />
              
              <div className="text-center text-sm text-muted-foreground">
                {progress}% Complete
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && extractedFrames.length > 0 && (
            <div className="space-y-4">
              <div className="aspect-video relative bg-black flex items-center justify-center overflow-hidden">
                <img 
                  src={currentFrame?.imageUrl} 
                  alt={`Frame at ${currentFrame?.timestamp}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-center">
                <div className="text-sm mb-2 sm:mb-0">
                  Frame {currentFrameIndex + 1} of {extractedFrames.length} • Timestamp: {currentFrame?.timestamp}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={prevFrame} 
                    disabled={currentFrameIndex === 0}
                    size="sm"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={nextFrame} 
                    disabled={currentFrameIndex === extractedFrames.length - 1}
                    size="sm"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          {currentStep === 'review' && (
            <Button onClick={completeExtraction}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Apply Frames to Slides
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {currentStep === 'review' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
