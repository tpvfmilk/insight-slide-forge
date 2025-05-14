
import { useState, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

export function useFrameCapture({
  videoRef,
  projectId,
  videoUrl,
  duration,
  formatTime,
  onFrameCaptured,
  togglePlayPause // Added parameter to control video playback
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  projectId: string;
  videoUrl: string | null;
  duration: number;
  formatTime: (seconds: number) => string;
  onFrameCaptured: (frame: ExtractedFrame) => void;
  togglePlayPause?: () => void; // Optional function to control video playback
}) {
  const [isCapturingFrame, setIsCapturingFrame] = useState<boolean>(false);
  const [capturedTimemarks, setCapturedTimemarks] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingRef = useRef<boolean>(false);
  
  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Safety checks
    if (!video || !canvas || !videoUrl || isCapturingFrame || !projectId) {
      console.error("Cannot capture frame: missing required elements or already capturing");
      return;
    }
    
    try {
      setIsCapturingFrame(true);
      
      // Pause the video before capturing if togglePlayPause is provided
      if (togglePlayPause && !video.paused) {
        togglePlayPause();
        // Short delay to ensure the frame is fully rendered before capturing
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Extract current timestamp
      const currentTime = video.currentTime;
      const timestamp = formatTime(currentTime);
      
      // Check if this timestamp has already been captured
      if (capturedTimemarks.some(time => Math.abs(time - currentTime) < 0.5)) {
        toast.info(`Frame at ${timestamp} already exists`);
        setIsCapturingFrame(false);
        return;
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // Draw the current video frame on the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => 
        canvas.toBlob(resolve, 'image/jpeg', 0.95)
      );
      
      if (!blob) {
        throw new Error("Failed to create image blob");
      }
      
      // Create a unique ID and filename for this frame
      const frameId = uuidv4();
      const filename = `project_${projectId}/frame_${timestamp.replace(/:/g, '_')}_${frameId}.jpg`;
      
      // Upload blob to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('slide_stills')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      // Get the public URL for the uploaded image
      const { data: publicUrlData } = supabase.storage
        .from('slide_stills')
        .getPublicUrl(filename);
      
      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error("Failed to get public URL");
      }
      
      // Create frame object with image URL and timestamp
      const newFrame: ExtractedFrame = {
        id: frameId,
        timestamp,
        imageUrl: publicUrlData.publicUrl,
      };
      
      // Mark this timestamp as captured
      setCapturedTimemarks(prev => [...prev, currentTime].sort((a, b) => a - b));
      
      // Call the callback with the new frame
      onFrameCaptured(newFrame);
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast.error("Failed to capture frame");
      
      // If the frame capture fails and we need a placeholder for testing
      if (process.env.NODE_ENV === 'development' && pendingRef.current === false) {
        pendingRef.current = true;
        
        // This is only for development testing - create a placeholder frame
        const currentTime = videoRef.current?.currentTime || 0;
        const timestamp = formatTime(currentTime);
        
        // Create a placeholder frame
        const placeholderFrame: ExtractedFrame = {
          id: uuidv4(),
          timestamp,
          imageUrl: `https://placehold.co/800x450/333/white?text=Frame+${timestamp}`,
        };
        
        // Mark this timestamp as captured
        setCapturedTimemarks(prev => [...prev, currentTime].sort((a, b) => a - b));
        
        // Call the callback
        onFrameCaptured(placeholderFrame);
        
        // Fix: Replace toast with title/description to use Sonner's format
        toast("Placeholder frame created", {
          description: `Placeholder created at ${timestamp}`,
        });
      } else {
        throw error;
      }
    } finally {
      setIsCapturingFrame(false);
      pendingRef.current = false;
    }
  }, [videoRef, canvasRef, videoUrl, projectId, isCapturingFrame, capturedTimemarks, formatTime, onFrameCaptured, togglePlayPause]);
  
  return {
    captureFrame,
    isCapturingFrame,
    capturedTimemarks,
    setCapturedTimemarks,
    canvasRef
  };
}
