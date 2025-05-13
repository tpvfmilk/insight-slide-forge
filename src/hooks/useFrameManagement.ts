
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import {
  loadExtractedFrames,
  handleManualFrameSelection
} from "@/services/projectFrameService";
import { syncFramesWithDatabase } from "@/services/frameStorageService";

/**
 * Hook for managing video frames in a project
 */
export const useFrameManagement = (projectId: string | undefined) => {
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [isSyncingFrames, setIsSyncingFrames] = useState<boolean>(false);
  
  /**
   * Load frames from the project
   */
  const loadFramesFromProject = useCallback(async () => {
    if (!projectId) return [];
    
    try {
      const frames = await loadExtractedFrames(projectId);
      setExtractedFrames(frames);
      return frames;
    } catch (error) {
      console.error("Error loading frames from project:", error);
      return [];
    }
  }, [projectId]);
  
  /**
   * Merge frames with the existing library and save to database
   */
  const mergeFramesWithLibrary = useCallback(async (newFrames: ExtractedFrame[]): Promise<ExtractedFrame[]> => {
    if (!projectId) return [];
    
    try {
      // Create a map with all existing frames for efficient lookup
      const frameMap = new Map<string, ExtractedFrame>();
      
      // First add all existing frames
      extractedFrames.forEach(frame => {
        if (frame.id) {
          frameMap.set(frame.id, frame);
        }
      });
      
      // Add or update with new frames
      const processedNewFrames = newFrames.map(frame => {
        // Ensure all frames have an id
        const frameId = frame.id || `frame-${frame.timestamp?.replace(/:/g, "-")}-${Date.now()}`;
        
        return {
          ...frame,
          id: frameId
        } as ExtractedFrame;
      });
      
      processedNewFrames.forEach(frame => {
        if (frame.id) {
          frameMap.set(frame.id, frame);
        }
      });
      
      // Convert map back to array
      const mergedFrames = Array.from(frameMap.values());
      console.log(`Merged to ${mergedFrames.length} total frames in library`);
      
      // Update our state
      setExtractedFrames(mergedFrames);
      
      // Sync with database
      setIsSyncingFrames(true);
      try {
        await syncFramesWithDatabase(mergedFrames, projectId);
      } finally {
        setIsSyncingFrames(false);
      }
      
      return mergedFrames;
    } catch (error) {
      console.error("Error merging frames with library:", error);
      toast.error("Failed to update frame library");
      return extractedFrames;
    }
  }, [projectId, extractedFrames]);
  
  /**
   * Apply selected frames to slides
   */
  const applyFramesToSlides = useCallback(async (selectedFrames: ExtractedFrame[]): Promise<boolean> => {
    if (!projectId) return false;
    
    try {
      return await handleManualFrameSelection(projectId, selectedFrames, extractedFrames);
    } catch (error) {
      console.error("Error applying frames to slides:", error);
      toast.error("Failed to apply frames to slides");
      return false;
    }
  }, [projectId, extractedFrames]);
  
  return {
    extractedFrames,
    isSyncingFrames,
    loadFramesFromProject,
    mergeFramesWithLibrary,
    applyFramesToSlides
  };
};
