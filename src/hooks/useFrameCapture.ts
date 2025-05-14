
import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

export function useFrameCapture({
  videoRef,
  projectId,
  videoUrl,
  duration,
  formatTime,
  onFrameCaptured,
  allExtractedFrames = []
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  projectId: string;
  videoUrl: string | null;
  duration: number;
  formatTime: (seconds: number) => string;
  onFrameCaptured: (frame: ExtractedFrame) => void;
  allExtractedFrames?: ExtractedFrame[];
}) {
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedTimemarks, setCapturedTimemarks] = useState<number[]>([]);
  
  // Function to convert timestamp string to seconds
  const timeToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };
  
  // Initialize timemarks from existing frames on component mount
  useEffect(() => {
    if (allExtractedFrames && allExtractedFrames.length > 0) {
      // Filter out frames without timestamps
      const validFrames = allExtractedFrames.filter(frame => frame && frame.timestamp);
      
      if (validFrames.length > 0) {
        console.log(`Initializing ${validFrames.length} timemarks from existing frames`);
        const existingTimemarks = validFrames.map(frame => timeToSeconds(frame.timestamp));
        setCapturedTimemarks(existingTimemarks);
      }
    }
  }, [allExtractedFrames]);

  // Capture frame function
  const captureFrame = async () => {
    if (!videoRef.current || !videoRef.current.videoWidth || !canvasRef.current || !projectId || !videoUrl || isCapturingFrame) {
      return;
    }

    try {
      setIsCapturingFrame(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get timestamp
      const timestamp = formatTime(video.currentTime);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
      });
      
      if (!blob) {
        throw new Error("Failed to create image blob");
      }
      
      // Create unique filename
      const frameId = uuidv4();
      const filename = `project_${projectId}/${frameId}.jpg`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('slide_stills')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) {
        throw new Error(`Error uploading frame: ${uploadError.message}`);
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('slide_stills')
        .getPublicUrl(filename);
        
      if (!publicUrl) {
        throw new Error("Failed to get public URL for uploaded frame");
      }
      
      // Create frame object
      const extractedFrame: ExtractedFrame = {
        id: frameId,
        timestamp,
        imageUrl: publicUrl,
        sourceVideoTime: video.currentTime,
        capturedAt: new Date().toISOString(),
      };
      
      // Add timestamp to captured timemarks
      setCapturedTimemarks(prev => [...prev, video.currentTime]);
      
      // Call the callback
      onFrameCaptured(extractedFrame);
      
    } catch (error) {
      console.error("Error capturing frame:", error);
    } finally {
      setIsCapturingFrame(false);
    }
  };

  return {
    captureFrame,
    isCapturingFrame,
    canvasRef,
    capturedTimemarks,
    setCapturedTimemarks
  };
}
