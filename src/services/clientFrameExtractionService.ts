
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
      
      toast.success(`Successfully extracted ${extractedFrames.length} frames`, {
        id: 'extract-frames'
      });
      
      // Upload each extracted frame
      const uploadedFrames: ExtractedFrame[] = [];
      
      for (const { frame, timestamp } of extractedFrames) {
        try {
          // Create a File from the Blob
          const file = new File([frame], `frame-${timestamp.replace(/:/g, "-")}.jpg`, {
            type: 'image/jpeg'
          });
          
          // Upload the file
          const { data: uploadData } = await supabase
            .storage
            .from('slide_stills')
            .upload(`${projectId}/${timestamp.replace(/:/g, '_')}.jpg`, file, {
              cacheControl: '3600',
              upsert: true
            });
            
          if (!uploadData?.path) {
            console.warn(`Failed to upload frame at ${timestamp}`);
            continue;
          }
          
          // Get public URL
          const { data: urlData } = supabase
            .storage
            .from('slide_stills')
            .getPublicUrl(uploadData.path);
            
          uploadedFrames.push({
            timestamp,
            imageUrl: urlData.publicUrl,
            id: `frame-${timestamp.replace(/:/g, "-")}`,
            isPlaceholder: false
          });
          
        } catch (uploadError) {
          console.error(`Error uploading frame at ${timestamp}:`, uploadError);
        }
      }
      
      if (uploadedFrames.length > 0) {
        // Save these frames to the project
        await saveExtractedFramesToProject(projectId, uploadedFrames);
        
        return { 
          success: true, 
          frames: [...uploadedFrames, ...existingFrames.filter(existing => 
            !uploadedFrames.some(uploaded => uploaded.timestamp === existing.timestamp)
          )]
        };
      } else {
        console.error('Client-side extraction succeeded but uploads failed');
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

// Helper function to save extracted frames to the project
async function saveExtractedFramesToProject(projectId: string, frames: ExtractedFrame[]): Promise<void> {
  // Get existing frames
  const { data: project } = await supabase
    .from('projects')
    .select('extracted_frames')
    .eq('id', projectId)
    .single();
    
  const existingFrames: ExtractedFrame[] = project?.extracted_frames as unknown as ExtractedFrame[] || [];
  
  // Merge existing and new frames, avoiding duplicates
  const updatedFrames = [
    ...frames,
    ...existingFrames.filter(existing => 
      !frames.some(frame => frame.timestamp === existing.timestamp)
    )
  ];
  
  // Update project
  await updateProject(projectId, {
    extracted_frames: updatedFrames
  });
}

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
