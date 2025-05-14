
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
  onFrameCaptured
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  projectId: string;
  videoUrl: string | null;
  duration: number;
  formatTime: (seconds: number) => string;
  onFrameCaptured: (frame: ExtractedFrame) => void;
}) {
  const [isCapturingFrame, setIsCapturingFrame] = useState<boolean>(false);
  const [capturedTimemarks, setCapturedTimemarks] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingRef = useRef<boolean>(false);
  
  // Improved function to capture frames with better error handling and logging
  const captureFrame = useCallback(async () => {
    console.log("Frame capture started");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Safety checks
    if (!video || !canvas || !videoUrl || isCapturingFrame || !projectId) {
      console.error("Cannot capture frame:", {
        videoExists: !!video,
        canvasExists: !!canvas,
        videoUrl: videoUrl,
        isCapturingFrame: isCapturingFrame,
        projectId: projectId
      });
      return;
    }
    
    try {
      setIsCapturingFrame(true);
      
      // Extract current timestamp
      const currentTime = video.currentTime;
      const timestamp = formatTime(currentTime);
      console.log(`Attempting to capture frame at ${timestamp} (${currentTime}s)`);
      
      // Check if this timestamp has already been captured
      if (capturedTimemarks.some(time => Math.abs(time - currentTime) < 0.5)) {
        toast.info(`Frame at ${timestamp} already exists`);
        setIsCapturingFrame(false);
        return;
      }
      
      // Important: First pause the video to ensure a stable frame
      const wasPlaying = !video.paused;
      if (wasPlaying) {
        video.pause();
        // Wait a moment for the pause to take effect
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log("Video paused for stable frame");
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      console.log(`Canvas dimensions set to ${canvas.width}x${canvas.height}`);
      
      // Make sure we have a valid context
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // Apply slight adjustments to enhance frame clarity
      ctx.filter = "contrast(1.05) brightness(1.05)";
      
      // Clear canvas before drawing to prevent artifacts
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the current video frame on the canvas
      console.log("Drawing video frame to canvas");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Check if the frame is mostly black or empty
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let totalBrightness = 0;
      // Sample pixels for performance
      const sampleSize = 10000; 
      const step = Math.floor(data.length / 4 / sampleSize);
      
      for (let i = 0; i < data.length; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Simple brightness calculation
        totalBrightness += (r + g + b) / 3;
      }
      
      const avgBrightness = totalBrightness / sampleSize;
      console.log(`Frame brightness: ${avgBrightness}`);
      
      // If the frame is too dark, try an alternative approach
      if (avgBrightness < 20) {
        console.log("Frame too dark, trying alternative capture method");
        
        // Try to adjust contrast/brightness to improve visibility
        ctx.filter = "contrast(1.5) brightness(1.5)";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Check brightness again
        const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newData = newImageData.data;
        let newTotalBrightness = 0;
        
        for (let i = 0; i < newData.length; i += 4 * step) {
          const r = newData[i];
          const g = newData[i + 1];
          const b = newData[i + 2];
          newTotalBrightness += (r + g + b) / 3;
        }
        
        const newAvgBrightness = newTotalBrightness / sampleSize;
        console.log(`Adjusted frame brightness: ${newAvgBrightness}`);
        
        // If still too dark, notify user
        if (newAvgBrightness < 20) {
          console.warn("Frame still too dark after adjustment");
          toast.warning("The captured frame appears to be dark or blank. You may want to try at a different timestamp.");
        }
      }
      
      // Convert canvas to blob
      console.log("Converting canvas to blob");
      const blob = await new Promise<Blob | null>((resolve) => 
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
      );
      
      if (!blob) {
        throw new Error("Failed to create image blob");
      }
      
      console.log(`Blob created with size: ${Math.round(blob.size / 1024)} KB`);
      
      // Create a unique ID and filename for this frame
      const frameId = uuidv4();
      const filename = `project_${projectId}/frame_${timestamp.replace(/:/g, '_')}_${frameId}.jpg`;
      
      console.log(`Uploading frame to storage: ${filename}`);
      
      // Upload blob to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('slide_stills')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });
      
      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      console.log("Frame uploaded successfully:", uploadData);
      
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
      
      console.log("Frame object created:", newFrame);
      
      // Mark this timestamp as captured
      setCapturedTimemarks(prev => [...prev, currentTime].sort((a, b) => a - b));
      
      // Call the callback with the new frame
      onFrameCaptured(newFrame);
      
      // Resume playback if the video was playing
      if (wasPlaying) {
        try {
          await video.play();
        } catch (playError) {
          console.warn("Could not resume playback:", playError);
        }
      }
      
      toast.success(`Frame captured at ${timestamp}`);
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast.error("Failed to capture frame: " + (error instanceof Error ? error.message : "Unknown error"));
      
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
        
        // Use Sonner's format
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
  }, [videoRef, canvasRef, videoUrl, projectId, isCapturingFrame, capturedTimemarks, formatTime, onFrameCaptured]);
  
  return {
    captureFrame,
    isCapturingFrame,
    capturedTimemarks,
    setCapturedTimemarks,
    canvasRef
  };
}
