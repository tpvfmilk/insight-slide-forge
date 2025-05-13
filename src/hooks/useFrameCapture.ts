
import { useState, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

// Interface for frames with blobs that extends ExtractedFrame
export interface CapturedFrameWithBlob {
  timestamp: string;
  imageUrl: string;
  id?: string;
  isPlaceholder?: boolean;
  blob: Blob;
}

export function useFrameCapture({
  videoRef,
  projectId,
  videoUrl,
  duration,
  formatTime,
  onFrameCaptured
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  projectId: string;
  videoUrl: string | null;
  duration: number;
  formatTime: (seconds: number) => string;
  onFrameCaptured: (frame: ExtractedFrame) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);
  const [capturedTimemarks, setCapturedTimemarks] = useState<number[]>([]);
  
  // Helper function to upload a captured frame to Supabase storage
  const uploadFrameToStorage = async (frame: Blob, timestamp: string): Promise<string | null> => {
    try {
      if (!projectId) {
        throw new Error("Project ID is required to upload frames");
      }
      
      // Create a File from the Blob
      const fileName = `frame-${timestamp.replace(/:/g, "-")}-${Date.now()}.jpg`;
      const file = new File([frame], fileName, {
        type: 'image/jpeg'
      });
      
      // Upload to Supabase Storage - ensure proper path and bucket
      const filePath = `${projectId}/${timestamp.replace(/:/g, '_')}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('slide_stills')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (uploadError || !uploadData?.path) {
        console.error("Error uploading frame:", uploadError);
        return null;
      }
      
      // Get public URL - CRUCIAL for persistence
      const { data: urlData } = supabase
        .storage
        .from('slide_stills')
        .getPublicUrl(uploadData.path);
        
      console.log(`Frame uploaded successfully, got permanent URL: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error("Error in uploadFrameToStorage:", error);
      return null;
    }
  };
  
  // Capture current frame using the improved extraction service
  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl || isCapturingFrame) return;
    
    try {
      setIsCapturingFrame(true);
      
      // Pause the video
      video.pause();
      
      // Store current time
      const currentTimePosition = video.currentTime;
      const timestamp = formatTime(currentTimePosition);
      
      const toastId = "capture-frame";
      toast({
        title: `Capturing frame at ${timestamp}...`,
        description: "Please wait while the frame is being processed",
      });
      
      // Use our advanced frame extraction to get a good quality frame
      const extractedFrames = await extractFramesFromVideoUrl(
        videoUrl, 
        [timestamp],
        undefined,
        duration,
        {
          captureAttempts: 5, // More attempts
          captureOffsets: [-0.1, 0, 0.1, 0.2, -0.2, 0.5, -0.5, 0.8, -0.8], // More offsets
          minContentThreshold: 0.02 // Slightly lower threshold
        }
      );
      
      if (extractedFrames && extractedFrames.length > 0) {
        const { frame, timestamp: extractedTimestamp } = extractedFrames[0];
        
        // Upload the frame to storage to get a permanent URL
        const permanentUrl = await uploadFrameToStorage(frame, extractedTimestamp);
        
        if (!permanentUrl) {
          toast({
            title: "Failed to upload frame",
            description: `Could not save frame at ${timestamp}`,
            variant: "destructive",
          });
          createPlaceholderFrame(currentTimePosition);
          return;
        }
        
        // Create a new extracted frame with permanent URL
        const frameId = `frame-${Date.now()}-${extractedTimestamp}`;
        
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl: permanentUrl, // Use permanent URL from storage
          timestamp: extractedTimestamp,
          isPlaceholder: false
        };
        
        // Add to captured timemarks
        setCapturedTimemarks(prev => [...prev, currentTimePosition]);
        
        // Call the callback
        onFrameCaptured(newFrame);
        
        toast({
          title: "Frame captured",
          description: `Frame at ${timestamp} has been saved`,
        });
        
        console.log(`Frame captured and stored with permanent URL: ${permanentUrl}`);
      } else {
        // Create placeholder if extraction failed
        createPlaceholderFrame(currentTimePosition);
        
        toast({
          title: "Could not capture frame",
          description: `Failed to extract frame at ${timestamp}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast({
        title: "Failed to capture frame",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsCapturingFrame(false);
    }
  };
  
  // Create a placeholder frame when capture fails
  const createPlaceholderFrame = async (timeInSeconds: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast({
        title: "Failed to create placeholder frame",
        variant: "destructive",
      });
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({
        title: "Failed to create placeholder frame",
        variant: "destructive",
      });
      return;
    }
    
    // Set canvas size if not already set
    canvas.width = 640;
    canvas.height = 360;
    
    // Format timestamp
    const timestamp = formatTime(timeInSeconds);
    
    // Draw placeholder
    ctx.fillStyle = "#2563eb"; // Blue background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text explanation
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Frame at ${timestamp}`, canvas.width / 2, canvas.height / 2 - 15);
    ctx.font = "18px Arial";
    ctx.fillText("Could not extract frame from video", canvas.width / 2, canvas.height / 2 + 20);
    
    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        // Upload placeholder to storage
        const permanentUrl = await uploadFrameToStorage(blob, timestamp);
        
        if (!permanentUrl) {
          toast({
            title: "Failed to upload placeholder frame",
            variant: "destructive",
          });
          return;
        }
        
        // Generate unique ID for the frame
        const frameId = `frame-${Date.now()}-placeholder`;
        
        // Create a new extracted frame with permanent URL
        const newFrame: ExtractedFrame = {
          id: frameId,
          imageUrl: permanentUrl, // Use permanent URL from storage
          timestamp,
          isPlaceholder: true
        };
        
        // Add to captured timemarks
        setCapturedTimemarks(prev => [...prev, timeInSeconds]);
        
        // Call the callback
        onFrameCaptured(newFrame);
        
        toast({
          title: "Placeholder frame created",
          description: `Placeholder created at ${timestamp}`,
        });
      } else {
        toast({
          title: "Failed to create placeholder frame",
          variant: "destructive",
        });
      }
    }, "image/jpeg", 0.95);
  };
  
  return {
    canvasRef,
    isCapturingFrame,
    capturedTimemarks,
    setCapturedTimemarks,
    captureFrame
  };
}
