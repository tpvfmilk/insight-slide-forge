
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
      // Start the frame capture process
      console.log("Starting frame capture...");
      setIsCapturingFrame(true);
      const toastId = "frame-capture";
      toast.loading("Capturing frame...", { id: toastId, duration: 5000 });
      
      // Always ensure the video is paused before capturing
      const wasPlaying = !video.paused;
      if (wasPlaying && togglePlayPause) {
        togglePlayPause();
        // Add a longer delay to ensure the frame is fully rendered before capturing
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Extract current timestamp
      const currentTime = video.currentTime;
      const timestamp = formatTime(currentTime);
      console.log(`Capturing frame at ${timestamp} (${currentTime}s)`);
      
      // Check if this timestamp has already been captured
      if (capturedTimemarks.some(time => Math.abs(time - currentTime) < 0.5)) {
        toast.info(`Frame at ${timestamp} already exists`, { id: toastId });
        setIsCapturingFrame(false);
        return;
      }
      
      // Set canvas dimensions to match video
      console.log(`Setting canvas dimensions to ${video.videoWidth}x${video.videoHeight}`);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Create a new canvas that we'll add to the document body
      // This ensures it's properly rendered even if the original canvas is hidden
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      tempCanvas.style.position = "absolute";
      tempCanvas.style.left = "-9999px";
      tempCanvas.style.visibility = "hidden";
      document.body.appendChild(tempCanvas);
      
      const ctx = tempCanvas.getContext('2d', { 
        alpha: false,
        desynchronized: true 
      });
      
      if (!ctx) {
        document.body.removeChild(tempCanvas);
        throw new Error("Could not get canvas context");
      }
      
      // Try multiple approaches to capture a good frame
      console.log("Drawing video to canvas...");
      
      // Approach 1: Basic drawing
      ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Approach 2: If needed, try with creating an intermediary bitmap
      if (typeof createImageBitmap === 'function') {
        try {
          const bitmap = await createImageBitmap(video);
          ctx.drawImage(bitmap, 0, 0, tempCanvas.width, tempCanvas.height);
          bitmap.close();
          console.log("Used ImageBitmap for improved capture");
        } catch (e) {
          console.warn("ImageBitmap approach failed, using direct canvas drawing", e);
        }
      }
      
      // Convert canvas to blob with higher quality
      console.log("Converting canvas to blob...");
      const blob = await new Promise<Blob | null>((resolve) => 
        tempCanvas.toBlob(resolve, 'image/jpeg', 0.95)
      );
      
      // Clean up temp canvas
      document.body.removeChild(tempCanvas);
      
      if (!blob) {
        throw new Error("Failed to create image blob");
      }
      
      console.log(`Captured blob size: ${blob.size} bytes`);
      if (blob.size < 1000) {
        console.warn("Captured image is very small, might be black or empty");
      }
      
      // Create a unique ID and filename for this frame
      const frameId = uuidv4();
      const filename = `project_${projectId}/frame_${timestamp.replace(/:/g, '_')}_${frameId}.jpg`;
      
      // Upload blob to Supabase Storage
      console.log(`Uploading frame to Supabase: ${filename}`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('slide_stills')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
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
      
      // Display success message
      toast.success(`Frame captured at ${timestamp}`, { id: toastId });
      
      // Call the callback with the new frame
      console.log("Calling onFrameCaptured with frame:", newFrame);
      onFrameCaptured(newFrame);
      
      // Log confirmation of successful capture
      console.log("Frame captured and saved to project library");
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
