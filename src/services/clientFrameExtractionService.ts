
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { updateProject } from './projectService';
import { Json } from '@/integrations/supabase/types';

// Update ExtractedFrame to be JSON-compatible
export interface ExtractedFrame {
  timestamp: string;
  imageUrl: string;
  id?: string;
  [key: string]: string | number | boolean | null | undefined;
}

// Function to extract frames from a video using client-side code
export const clientExtractFramesFromVideo = async (
  projectId: string,
  videoPath: string,
  timestamps: string[],
  videoDuration?: number // Add optional videoDuration parameter
): Promise<{ 
  success: boolean; 
  frames?: ExtractedFrame[]; 
  error?: string;
  skipExtraction?: boolean;
  videoDuration?: number; // Add videoDuration to the return type
}> => {
  if (!timestamps || timestamps.length === 0) {
    return { success: false, error: 'No timestamps provided for extraction' };
  }

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

    const existingFrames: ExtractedFrame[] = project.extracted_frames as unknown as ExtractedFrame[] || [];
    
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
      return { success: false, error: urlError.message };
    }

    // Return success to indicate the video is ready to be processed by the client
    return { 
      success: true,
      frames: existingFrames,
      videoDuration // Pass duration to client for validation
    };
    
  } catch (error) {
    console.error('Error in client frame extraction preparation:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error in frame extraction' 
    };
  }
};

// Function to update slides with extracted frames
export const updateSlidesWithExtractedFrames = async (
  projectId: string,
  extractedFrames: ExtractedFrame[]
): Promise<boolean> => {
  try {
    console.log('Updating slides with extracted frames:', extractedFrames);
    
    if (!extractedFrames || extractedFrames.length === 0) {
      console.error('No extracted frames provided');
      return false;
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

    // Combine existing extracted frames with new ones
    let allExtractedFrames = [...extractedFrames];
    
    if (project.extracted_frames && Array.isArray(project.extracted_frames)) {
      // Get existing frames from project
      const existingFrames = project.extracted_frames as ExtractedFrame[];
      
      // Merge existing frames with new ones, avoiding duplicates
      existingFrames.forEach(existingFrame => {
        const isDuplicate = allExtractedFrames.some(
          newFrame => newFrame.timestamp === existingFrame.timestamp
        );
        
        if (!isDuplicate) {
          allExtractedFrames.push(existingFrame);
        }
      });
    }

    // Save all extracted frames to the project
    await updateProject(projectId, {
      extracted_frames: allExtractedFrames
    });

    // Now update the slides with frame images where needed
    const updatedSlides = project.slides.map((slide: any) => {
      if (slide.timestamp) {
        // Find a matching frame
        const matchingFrame = extractedFrames.find(
          frame => frame.timestamp === slide.timestamp
        );
        
        // If found, update the slide
        if (matchingFrame) {
          return {
            ...slide,
            image: matchingFrame.imageUrl,
            frameSource: 'extracted'
          };
        }
      }
      
      return slide;
    });

    // Update the project with the modified slides
    await updateProject(projectId, {
      slides: updatedSlides
    });

    return true;
  } catch (error) {
    console.error('Error updating slides with extracted frames:', error);
    return false;
  }
};
