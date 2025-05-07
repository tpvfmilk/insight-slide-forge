
import { supabase } from "@/integrations/supabase/client";
import { uploadSlideImage } from "@/services/imageService";
import { timestampToSeconds, formatDuration } from "@/utils/formatUtils";
import { extractFrameFromVideo } from "@/utils/videoFrameExtractor";

export interface ExtractedFrame {
  timestamp: string;
  imageUrl: string;
  [key: string]: string | number | boolean | null; // Makes it Json-compatible
}

/**
 * Extracts frames from a video file at the given timestamps
 * This is a client-side function that uses the canvas API
 */
export const clientExtractFramesFromVideo = async (
  projectId: string,
  videoPath: string,
  timestamps: string[]
): Promise<{
  success: boolean;
  error?: string;
  frames?: ExtractedFrame[];
}> => {
  try {
    // Check if we already have extracted frames for this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .maybeSingle();
      
    if (projectError) {
      console.error("Error fetching project extracted frames:", projectError);
      throw new Error("Failed to check for existing frames");
    }
    
    // Check if we already have the frames in storage
    if (project?.extracted_frames && Array.isArray(project.extracted_frames)) {
      const existingFrames = project.extracted_frames as unknown as ExtractedFrame[];
      
      // Check if we have all the requested timestamps
      const missingTimestamps = timestamps.filter(timestamp => 
        !existingFrames.some(frame => frame.timestamp === timestamp)
      );
      
      // If we have all the frames already, just return them
      if (missingTimestamps.length === 0) {
        console.log("All requested frames already exist, returning them");
        return {
          success: true,
          frames: existingFrames
        };
      }
      
      console.log(`Missing ${missingTimestamps.length} frames, will extract them`);
    }
    
    // Get a signed URL for the video
    const { data: urlData, error: urlError } = await supabase
      .from("videos")
      .createSignedUrl(videoPath, 3600); // 1 hour expiry
    
    if (urlError || !urlData?.signedUrl) {
      console.error("Error creating signed URL for video:", urlError);
      throw new Error("Failed to get video URL");
    }
    
    // Create a video element
    const video = document.createElement('video');
    
    // Return a promise that resolves when all frames are extracted
    return new Promise((resolve, reject) => {
      let framesProcessed = 0;
      const extractedFrames: ExtractedFrame[] = [];
      
      // Setup video event handlers
      video.onloadeddata = async () => {
        try {
          console.log(`Video loaded, extracting ${timestamps.length} frames`);
          
          // Process each timestamp
          for (const timestamp of timestamps) {
            try {
              // Skip if this timestamp has been processed already
              if (extractedFrames.some(frame => frame.timestamp === timestamp)) {
                continue;
              }
              
              // Convert timestamp to seconds
              const seconds = timestampToSeconds(timestamp);
              
              // Extract frame from video
              const frameBlob = await extractFrameFromVideo(video, seconds);
              
              // Create a file from the blob
              const filename = `frame-${timestamp.replace(/:/g, "-")}.jpg`;
              const file = new File([frameBlob], filename, { type: 'image/jpeg' });
              
              // Upload the file
              const uploadResult = await uploadSlideImage(file);
              
              if (!uploadResult || !uploadResult.url) {
                console.error(`Failed to upload frame at ${timestamp}`);
                continue;
              }
              
              // Add to extracted frames
              extractedFrames.push({
                timestamp,
                imageUrl: uploadResult.url
              });
              
              framesProcessed++;
              console.log(`Processed ${framesProcessed} of ${timestamps.length} frames`);
            } catch (frameError) {
              console.error(`Error extracting frame at ${timestamp}:`, frameError);
            }
          }
          
          resolve({
            success: true,
            frames: extractedFrames
          });
        } catch (error) {
          reject(error);
        } finally {
          // Clean up
          video.pause();
          video.removeAttribute('src');
          video.load();
        }
      };
      
      video.onerror = (e) => {
        console.error('Video loading error:', e);
        reject(new Error("Failed to load video"));
      };
      
      // Set the source and load the video
      video.src = urlData.signedUrl;
      video.preload = 'auto';
    });
  } catch (error) {
    console.error('Error extracting frames from video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Update the project to associate extracted frames with slides
 */
export const updateSlidesWithExtractedFrames = async (
  projectId: string,
  extractedFrames: ExtractedFrame[]
): Promise<boolean> => {
  try {
    if (!projectId || !extractedFrames.length) {
      return false;
    }
    
    // First get the existing project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('slides, extracted_frames')
      .eq('id', projectId)
      .maybeSingle();
      
    if (projectError) {
      console.error("Error fetching project:", projectError);
      throw new Error("Failed to fetch project");
    }
    
    if (!project) {
      throw new Error("Project not found");
    }
    
    // Save the extracted frames to the project
    let allFrames: ExtractedFrame[] = [];
    
    // Combine with existing frames if available
    if (project.extracted_frames && Array.isArray(project.extracted_frames)) {
      const existingFrames = project.extracted_frames as unknown as ExtractedFrame[];
      
      // Merge the new frames with existing ones, avoiding duplicates
      allFrames = existingFrames.filter(existing => 
        !extractedFrames.some(newFrame => newFrame.timestamp === existing.timestamp)
      );
      
      // Add the new frames
      allFrames = [...allFrames, ...extractedFrames];
    } else {
      allFrames = extractedFrames;
    }
    
    // Save the extracted frames to the project
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        extracted_frames: allFrames as unknown as any
      })
      .eq('id', projectId);
      
    if (updateError) {
      console.error("Error updating project with extracted frames:", updateError);
      throw new Error("Failed to save extracted frames");
    }
    
    // Update the slides if present
    if (project.slides && Array.isArray(project.slides)) {
      const updatedSlides = project.slides.map((slide: any) => {
        // If slide has a timestamp, find the matching frame
        if (slide.timestamp) {
          const matchingFrame = extractedFrames.find(frame => 
            frame.timestamp === slide.timestamp
          );
          
          if (matchingFrame) {
            return {
              ...slide,
              imageUrl: matchingFrame.imageUrl
            };
          }
        }
        
        // If slide has transcriptTimestamps, find matching frames for each
        if (slide.transcriptTimestamps && Array.isArray(slide.transcriptTimestamps)) {
          const matchingFrames = slide.transcriptTimestamps
            .map((timestamp: string) => 
              extractedFrames.find(frame => frame.timestamp === timestamp)
            )
            .filter(Boolean)
            .map((frame: any) => frame.imageUrl);
          
          if (matchingFrames.length > 0) {
            return {
              ...slide,
              imageUrls: matchingFrames
            };
          }
        }
        
        return slide;
      });
      
      // Save the updated slides
      const { error: slidesUpdateError } = await supabase
        .from('projects')
        .update({
          slides: updatedSlides
        })
        .eq('id', projectId);
        
      if (slidesUpdateError) {
        console.error("Error updating slides with frame images:", slidesUpdateError);
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error updating slides with extracted frames:", error);
    return false;
  }
};
