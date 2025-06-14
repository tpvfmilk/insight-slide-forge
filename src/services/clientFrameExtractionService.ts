
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { updateProject } from './projectService';
import { Json } from '@/integrations/supabase/types';
import { extractFramesFromVideoUrl } from '@/utils/videoFrameExtractor';
import { toast } from 'sonner';

// Update ExtractedFrame to be JSON-compatible
export interface ExtractedFrame {
  timestamp: string;
  imageUrl: string;
  id?: string;
  isPlaceholder?: boolean; // Add flag to indicate if frame is a placeholder
  [key: string]: string | number | boolean | null | undefined;
  // Note: Blob cannot be part of this interface as it's not JSON-compatible
  // Any blob data should be handled separately
}

// Function to extract frames from a video using client-side code
export const clientExtractFramesFromVideo = async (
  projectId: string,
  videoPath: string,
  timestamps: string[],
  videoDuration?: number,
  options?: {
    fallbackToServer?: boolean;
    forceServerSide?: boolean;
  }
): Promise<{ 
  success: boolean; 
  frames?: ExtractedFrame[]; 
  error?: string;
  skipExtraction?: boolean;
  videoDuration?: number;
}> => {
  if (!timestamps || timestamps.length === 0) {
    return { success: false, error: 'No timestamps provided for extraction' };
  }

  // Ignore fallback and force server options - server-side extraction is disabled
  const fallbackToServer = false;
  const forceServerSide = false;
  
  try {
    // First check if we already have the extracted frames
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('extracted_frames, video_metadata')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Error fetching project for frame extraction:', projectError);
      return { success: false, error: projectError.message };
    }

    const existingFrames: ExtractedFrame[] = project?.extracted_frames as unknown as ExtractedFrame[] || [];
    
    // Get video duration from project if not provided
    if (!videoDuration && project.video_metadata) {
      try {
        const metadata = project.video_metadata as { duration?: number };
        if (metadata.duration) {
          videoDuration = metadata.duration;
          console.log(`Using video duration from metadata: ${videoDuration}s`);
        }
      } catch (error) {
        console.warn('Could not extract video duration from metadata:', error);
      }
    }
    
    // Check if we already have all the timestamps
    if (existingFrames.length > 0) {
      const allTimestampsExist = timestamps.every(timestamp => 
        existingFrames.some(frame => frame.timestamp === timestamp)
      );
      
      if (allTimestampsExist) {
        console.log('All frames already extracted:', existingFrames);
        return { success: true, frames: existingFrames, skipExtraction: true };
      }
    }

    // Generate signed URL for video access
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('video_uploads')
      .createSignedUrl(videoPath, 60 * 60); // 1 hour expiry

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      
      // Try to get source URL from project
      const { data: projectData } = await supabase
        .from('projects')
        .select('source_url')
        .eq('id', projectId)
        .single();
        
      if (projectData?.source_url) {
        console.log('Using project source URL as fallback');
        
        // Use the source_url directly if signed URL fails
        try {
          toast.loading('Extracting frames from video...', {
            id: 'extract-frames',
            duration: Infinity
          });
          
          // Extract frames using the source URL
          const extractedFrames = await extractFramesFromVideoUrl(
            projectData.source_url, 
            timestamps,
            (completed, total) => {
              console.log(`Frame extraction progress: ${completed}/${total}`);
            },
            videoDuration
          );
          
          if (!extractedFrames || extractedFrames.length === 0) {
            toast.error('No frames could be extracted from the video. Please try again or capture frames manually.', {
              id: 'extract-frames'
            });
            return { 
              success: false, 
              error: 'Failed to extract frames from source URL'
            };
          }
          
          // Upload extracted frames and continue with normal process
          const uploadedFrames = await uploadExtractedFrames(projectId, extractedFrames);
          await saveExtractedFramesToProject(projectId, uploadedFrames);
          
          toast.success(`Successfully extracted ${uploadedFrames.length} frames`, {
            id: 'extract-frames'
          });
          
          return { 
            success: true, 
            frames: [...uploadedFrames, ...existingFrames.filter(existing => 
              !uploadedFrames.some(uploaded => uploaded.timestamp === existing.timestamp)
            )]
          };
        } catch (sourceUrlError) {
          console.error('Error extracting frames from source URL:', sourceUrlError);
          toast.dismiss('extract-frames');
          return { success: false, error: 'Failed to extract frames from video source' };
        }
      }
      
      return { success: false, error: urlError.message };
    }

    // Server-side extraction is disabled, only use client-side extraction
    try {
      console.log('Attempting client-side frame extraction');
      const videoUrl = urlData.signedUrl;
      
      // Inform the user we're extracting frames
      toast.loading('Extracting frames from video...', {
        id: 'extract-frames',
        duration: Infinity
      });
      
      // Extract frames from video
      const extractedFrames = await extractFramesFromVideoUrl(
        videoUrl, 
        timestamps,
        (completed, total) => {
          console.log(`Frame extraction progress: ${completed}/${total}`);
        },
        videoDuration
      );
      
      // Check if any frames were extracted
      if (!extractedFrames || extractedFrames.length === 0) {
        toast.error('No frames could be extracted from the video. Please try again or capture frames manually.', {
          id: 'extract-frames'
        });
        console.error('Client-side extraction failed: No frames extracted');
        
        // Return failure - no fallback to server
        return { 
          success: false, 
          error: 'Failed to extract frames. Please try capturing frames manually.'
        };
      }
      
      // Upload each extracted frame
      const uploadedFrames = await uploadExtractedFrames(projectId, extractedFrames);
      
      if (uploadedFrames.length > 0) {
        // Save these frames to the project
        await saveExtractedFramesToProject(projectId, uploadedFrames);
        
        toast.success(`Successfully extracted ${uploadedFrames.length} frames`, {
          id: 'extract-frames'
        });
        
        return { 
          success: true, 
          frames: [...uploadedFrames, ...existingFrames.filter(existing => 
            !uploadedFrames.some(uploaded => uploaded.timestamp === existing.timestamp)
          )]
        };
      } else {
        console.error('Client-side extraction succeeded but uploads failed');
        toast.error('Failed to upload extracted frames', {
          id: 'extract-frames'
        });
        return { 
          success: false, 
          error: 'Failed to upload extracted frames'
        };
      }
      
    } catch (clientError) {
      console.error('Error in client-side extraction:', clientError);
      
      toast.error('Frame extraction failed. Please try again or try capturing frames manually.', {
        id: 'extract-frames'
      });
      
      // Return failure - no fallback to server
      return { 
        success: false, 
        error: clientError instanceof Error ? clientError.message : 'Unknown error in frame extraction'
      };
    }
  } catch (error) {
    console.error('Error in client frame extraction preparation:', error);
    toast.dismiss('extract-frames');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error in frame extraction' 
    };
  }
};

// Helper function to upload extracted frames - improved for persistence
async function uploadExtractedFrames(
  projectId: string, 
  extractedFrames: Array<{ timestamp: string; frame: Blob }>
): Promise<ExtractedFrame[]> {
  const uploadedFrames: ExtractedFrame[] = [];
  
  for (const { frame, timestamp } of extractedFrames) {
    try {
      // Create a unique filename with timestamp
      const uniqueId = Date.now().toString();
      const filename = `frame-${timestamp.replace(/:/g, "-")}-${uniqueId}.jpg`;
      
      // Create a File from the Blob
      const file = new File([frame], filename, {
        type: 'image/jpeg'
      });
      
      // Create a unique path for the file
      const filePath = `${projectId}/${timestamp.replace(/:/g, '_')}-${uniqueId}.jpg`;
      
      // Upload the file
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('slide_stills')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (uploadError || !uploadData?.path) {
        console.warn(`Failed to upload frame at ${timestamp}:`, uploadError);
        continue;
      }
      
      // Get public URL - this ensures we have a permanent URL
      const { data: urlData } = supabase
        .storage
        .from('slide_stills')
        .getPublicUrl(uploadData.path);
        
      const frameId = `frame-${timestamp.replace(/:/g, "-")}-${uniqueId}`;
      
      uploadedFrames.push({
        timestamp,
        imageUrl: urlData.publicUrl,
        id: frameId,
        isPlaceholder: false
      });
      
      console.log(`Successfully uploaded frame at ${timestamp} with permanent URL: ${urlData.publicUrl}`);
      
    } catch (uploadError) {
      console.error(`Error uploading frame at ${timestamp}:`, uploadError);
    }
  }
  
  return uploadedFrames;
}

// Improved helper function to save extracted frames to the project
async function saveExtractedFramesToProject(projectId: string, frames: ExtractedFrame[]): Promise<void> {
  try {
    // Verify all frames have valid (not blob:// URLs) before saving
    const invalidFrames = frames.filter(frame => 
      !frame.imageUrl || frame.imageUrl.startsWith('blob:')
    );
    
    if (invalidFrames.length > 0) {
      console.error("Cannot save frames with blob URLs to project:", invalidFrames);
      throw new Error("Cannot save frames with temporary URLs to project");
    }
    
    // Get existing frames
    const { data: project, error } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .single();
      
    if (error) {
      console.error("Error fetching project for frame saving:", error);
      throw new Error("Could not access project data");
    }
    
    const existingFrames: ExtractedFrame[] = project?.extracted_frames as unknown as ExtractedFrame[] || [];
    
    // Create a map by timestamp for efficient deduplication
    const framesMap = new Map<string, ExtractedFrame>();
    
    // Add existing frames first
    existingFrames.forEach(frame => {
      if (frame.timestamp) {
        framesMap.set(frame.timestamp, frame);
      }
    });
    
    // Then add new frames, which will override existing ones with the same timestamp
    frames.forEach(frame => {
      if (frame.timestamp) {
        framesMap.set(frame.timestamp, frame);
      }
    });
    
    // Convert map back to array
    const updatedFrames = Array.from(framesMap.values());
    
    console.log(`Saving ${frames.length} new frames, total frames: ${updatedFrames.length}`);
    
    // Update project
    const { error: updateError } = await supabase
      .from('projects')
      .update({ extracted_frames: updatedFrames })
      .eq('id', projectId);
      
    if (updateError) {
      console.error("Error updating project with frames:", updateError);
      throw new Error("Failed to save frames to project");
    }
  } catch (error) {
    console.error("Error in saveExtractedFramesToProject:", error);
    throw error;
  }
}

// Improved function to update slides with extracted frames
export const updateSlidesWithExtractedFrames = async (
  projectId: string,
  extractedFrames: ExtractedFrame[]
): Promise<boolean> => {
  try {
    console.log('Updating slides with extracted frames:', extractedFrames.length);
    
    if (!extractedFrames || extractedFrames.length === 0) {
      console.error('No extracted frames provided');
      return false;
    }
    
    // Verify all frames have valid URLs (not blob:// URLs) before updating slides
    const invalidFrames = extractedFrames.filter(frame => 
      !frame.imageUrl || frame.imageUrl.startsWith('blob:')
    );
    
    if (invalidFrames.length > 0) {
      console.error("Cannot update slides with blob URLs:", invalidFrames);
      throw new Error("Cannot update slides with temporary URLs");
    }

    // First, fetch the current project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('slides, extracted_frames')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Error fetching project:', projectError);
      return false;
    }

    // If no slides exist yet, we can't update them
    if (!project.slides || !Array.isArray(project.slides)) {
      console.error('No slides found in project');
      return false;
    }

    // First update the extracted_frames in the project to ensure persistence
    // This ensures we store all frames at the project level
    // Create a working array that we'll modify
    let combinedExtractedFrames = [...extractedFrames];
    
    if (project.extracted_frames && Array.isArray(project.extracted_frames)) {
      // Get existing frames from project
      const existingFrames = project.extracted_frames as ExtractedFrame[];
      
      // Create a map by timestamp
      const framesMap = new Map<string, ExtractedFrame>();
      
      // Add extracted frames first (newer ones)
      extractedFrames.forEach(frame => {
        if (frame.timestamp) {
          framesMap.set(frame.timestamp, frame);
        }
      });
      
      // Then add existing frames (older ones) if they don't exist
      existingFrames.forEach(frame => {
        if (frame.timestamp && !framesMap.has(frame.timestamp)) {
          framesMap.set(frame.timestamp, frame);
        }
      });
      
      // Convert map back to array
      combinedExtractedFrames = Array.from(framesMap.values());
    }

    // Save all extracted frames to the project
    await updateProject(projectId, {
      extracted_frames: combinedExtractedFrames
    });
    
    console.log(`Saved ${combinedExtractedFrames.length} total frames to project`);

    // Now update the slides with frame images where needed
    const updatedSlides = project.slides.map((slide: any) => {
      if (slide.timestamp) {
        // Find a matching frame
        const matchingFrame = combinedExtractedFrames.find(
          frame => frame.timestamp === slide.timestamp
        );
        
        // If found, update the slide
        if (matchingFrame) {
          return {
            ...slide,
            image: matchingFrame.imageUrl,
            imageUrl: matchingFrame.imageUrl, // Also set imageUrl for compatibility
            frameSource: 'extracted'
          };
        }
      }
      
      // Also check transcript timestamps
      if (slide.transcriptTimestamps && Array.isArray(slide.transcriptTimestamps) && slide.transcriptTimestamps.length > 0) {
        // Find all matching frames for this slide's timestamps
        const matchingFrames = slide.transcriptTimestamps
          .map(timestamp => combinedExtractedFrames.find(frame => frame.timestamp === timestamp))
          .filter(Boolean); // Remove undefined entries
        
        if (matchingFrames.length > 0) {
          const imageUrls = matchingFrames.map(frame => frame.imageUrl);
          
          return {
            ...slide,
            imageUrls, // Add multiple images
            image: matchingFrames[0].imageUrl, // Set first one as primary for compatibility
            imageUrl: matchingFrames[0].imageUrl, // Also set imageUrl for compatibility
            frameSource: 'extracted'
          };
        }
      }
      
      return slide;
    });

    // Update the project with the modified slides
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        slides: updatedSlides
      })
      .eq('id', projectId);
      
    if (updateError) {
      console.error("Error updating slides with frames:", updateError);
      return false;
    }

    console.log(`Successfully updated slides with frames`);
    return true;
  } catch (error) {
    console.error('Error updating slides with extracted frames:', error);
    return false;
  }
};
