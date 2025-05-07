
import { supabase } from "@/integrations/supabase/client";
import { uploadSlideImage } from "@/services/imageService";
import { timestampToSeconds, formatDuration } from "@/utils/formatUtils";
import { extractFramesFromVideoUrl } from "@/utils/videoFrameExtractor";
import { toast } from "sonner";

export interface ExtractedFrame {
  timestamp: string;
  imageUrl: string;
  isPlaceholder?: boolean;
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
    console.log(`Starting frame extraction process for project ${projectId} with ${timestamps.length} timestamps`);
    
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
      
      // Filter out placeholder frames that need to be re-extracted
      const validExistingFrames = existingFrames.filter(frame => !frame.isPlaceholder);
      
      // Check if we have all the requested timestamps as real frames (not placeholders)
      const missingTimestamps = timestamps.filter(timestamp => 
        !validExistingFrames.some(frame => frame.timestamp === timestamp)
      );
      
      // If we have all the frames already, just return them
      if (missingTimestamps.length === 0) {
        console.log("All requested frames already exist, returning them");
        return {
          success: true,
          frames: validExistingFrames
        };
      }
      
      console.log(`Missing ${missingTimestamps.length} frames, will extract them`);
      
      // If we only have some of the frames, return what we have and extract the rest
      if (validExistingFrames.length > 0) {
        // We'll return the ones we have now so the UI can update immediately
        console.log(`Returning ${validExistingFrames.length} existing frames while extracting ${missingTimestamps.length} missing frames`);
      }
    }
    
    // First try with 'video_uploads' bucket (default path)
    try {
      const { data: urlData, error: urlError } = await supabase
        .storage
        .from('video_uploads')
        .createSignedUrl(videoPath, 3600); // 1 hour expiry
      
      if (urlError || !urlData?.signedUrl) {
        throw new Error(`Error from video_uploads bucket: ${urlError?.message}`);
      }
      
      // Add cache busting parameter to ensure we get the latest version of the video
      const videoUrl = new URL(urlData.signedUrl);
      videoUrl.searchParams.append('_cb', Date.now().toString());
      
      // Success! Return the URL
      console.log(`Successfully got signed URL for video: ${videoUrl}`);
      return processVideoWithUrl(videoUrl.toString(), timestamps, projectId);
    } catch (videoUploadsError) {
      console.warn("Failed to get video from video_uploads bucket, trying 'videos' bucket...");
      
      // Try with 'videos' bucket as alternative
      try {
        // Extract just the filename from the path
        const filename = videoPath.split('/').pop();
        if (!filename) {
          throw new Error("Invalid video path format");
        }
        
        const { data: urlData, error: urlError } = await supabase
          .storage
          .from('videos')
          .createSignedUrl(filename, 3600);
        
        if (urlError || !urlData?.signedUrl) {
          throw new Error(`Error from videos bucket: ${urlError?.message}`);
        }
        
        // Add cache busting parameter to ensure we get the latest version of the video
        const videoUrl = new URL(urlData.signedUrl);
        videoUrl.searchParams.append('_cb', Date.now().toString());
        
        // Success with videos bucket!
        console.log(`Successfully got signed URL for video from videos bucket: ${videoUrl}`);
        return processVideoWithUrl(videoUrl.toString(), timestamps, projectId);
      } catch (videosBucketError) {
        // Both attempts failed
        console.error("Error creating signed URL for video:", { 
          videoUploadsError, 
          videosBucketError 
        });
        
        // Try to check if the video exists in the database but with a different path
        const { data: projectData, error: projectPathError } = await supabase
          .from('projects')
          .select('source_url')
          .eq('id', projectId)
          .maybeSingle();
          
        if (projectPathError) {
          console.error("Error fetching project source URL:", projectPathError);
        }
        
        // If we have a source URL in the project, try that instead
        if (projectData?.source_url) {
          console.log("Found source URL in project, trying that instead:", projectData.source_url);
          
          try {
            const sourceUrl = new URL(projectData.source_url);
            sourceUrl.searchParams.append('_cb', Date.now().toString());
            return processVideoWithUrl(sourceUrl.toString(), timestamps, projectId);
          } catch (sourceUrlError) {
            console.error("Failed to use source_url as fallback:", sourceUrlError);
          }
        }
        
        throw new Error("Failed to get video URL. Please check if the video file exists in storage.");
      }
    }
  } catch (error) {
    console.error('Error extracting frames from video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Process a video URL to extract frames
 * This is a helper function used by clientExtractFramesFromVideo
 */
const processVideoWithUrl = async (
  videoUrl: string, 
  timestamps: string[], 
  projectId: string
): Promise<{
  success: boolean;
  error?: string;
  frames?: ExtractedFrame[];
}> => {
  console.log(`Processing video with URL: ${videoUrl}`);
  console.log(`Extracting ${timestamps.length} timestamps: ${timestamps.join(', ')}`);
  
  // Create a video element
  const video = document.createElement('video');
  
  // Return a promise that resolves when all frames are extracted
  return new Promise((resolve, reject) => {
    let framesProcessed = 0;
    const extractedFrames: ExtractedFrame[] = [];
    
    // Setup video event handlers
    video.onloadeddata = async () => {
      try {
        console.log(`Video loaded successfully, dimensions: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`);
        
        // Sort timestamps to extract frames in chronological order
        const sortedTimestamps = [...timestamps].sort((a, b) => {
          return timestampToSeconds(a) - timestampToSeconds(b);
        });
        
        console.log(`Sorted timestamps: ${sortedTimestamps.join(', ')}`);
        
        // Process each timestamp
        for (const timestamp of sortedTimestamps) {
          try {
            // Skip if this timestamp has been processed already
            if (extractedFrames.some(frame => frame.timestamp === timestamp)) {
              console.log(`Skipping already processed timestamp: ${timestamp}`);
              continue;
            }
            
            // Convert timestamp to seconds
            const seconds = timestampToSeconds(timestamp);
            console.log(`Extracting frame at timestamp ${timestamp} (${seconds} seconds)`);
            
            // Extract frame from video by seeking to position and capturing
            video.currentTime = seconds;
            
            // Wait for video to seek to the position
            await new Promise<void>((seekResolve) => {
              const handleSeeked = () => {
                video.removeEventListener('seeked', handleSeeked);
                console.log(`Seeked to ${video.currentTime}s for timestamp ${timestamp}`);
                seekResolve();
              };
              video.addEventListener('seeked', handleSeeked);
            });
            
            // Create a canvas to capture the frame
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error("Failed to get canvas context");
            }
            
            // Draw the video frame to the canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Add timestamp watermark to the frame for debugging
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(`Timestamp: ${timestamp} (${seconds.toFixed(2)}s)`, 5, canvas.height - 5);
            
            // Convert the canvas to a blob
            const blob = await new Promise<Blob>((blobResolve) => {
              canvas.toBlob((blob) => {
                if (blob) blobResolve(blob);
                else reject(new Error("Failed to create blob"));
              }, 'image/jpeg', 0.95);
            });
            
            // Create a file from the blob
            const filename = `frame-${timestamp.replace(/:/g, "-")}-${Date.now()}.jpg`;
            const file = new File([blob], filename, { type: 'image/jpeg' });
            
            // Upload the file
            const uploadResult = await uploadSlideImage(file);
            
            if (!uploadResult || !uploadResult.url) {
              console.error(`Failed to upload frame at ${timestamp}`);
              continue;
            }
            
            console.log(`Successfully extracted and uploaded frame at ${timestamp}: ${uploadResult.url}`);
            
            // Add to extracted frames
            extractedFrames.push({
              timestamp,
              imageUrl: uploadResult.url,
              isPlaceholder: false
            });
            
            framesProcessed++;
            console.log(`Processed ${framesProcessed} of ${timestamps.length} frames`);
          } catch (frameError) {
            console.error(`Error extracting frame at ${timestamp}:`, frameError);
          }
        }
        
        // If we didn't extract any frames, create a placeholder
        if (extractedFrames.length === 0) {
          console.error("Failed to extract any frames from the video");
          return resolve({
            success: false,
            error: "Failed to extract frames from video"
          });
        }
        
        // Save the extracted frames to the project
        await updateProjectWithExtractedFrames(projectId, extractedFrames);
        
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
      const videoElement = e.target as HTMLVideoElement;
      const errorCode = videoElement.error ? videoElement.error.code : 'unknown';
      const errorMessage = videoElement.error ? videoElement.error.message : 'unknown';
      
      console.error('Video loading error:', {
        errorCode,
        errorMessage,
        videoUrl
      });
      
      reject(new Error(`Failed to load video (code: ${errorCode}, message: ${errorMessage})`));
    };
    
    // Log when metadata is loaded
    video.onloadedmetadata = () => {
      console.log(`Video metadata loaded, duration: ${video.duration}s`);
    };
    
    // Set the source and load the video
    console.log(`Setting video source: ${videoUrl}`);
    video.crossOrigin = "anonymous"; // Add cross-origin support
    video.src = videoUrl;
    video.preload = 'auto';
  });
};

/**
 * Save the extracted frames to the project
 */
async function updateProjectWithExtractedFrames(
  projectId: string,
  newFrames: ExtractedFrame[]
): Promise<void> {
  if (!projectId || newFrames.length === 0) {
    return;
  }
  
  try {
    console.log(`Saving ${newFrames.length} extracted frames to project ${projectId}`);
    
    // Get existing extracted frames
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('extracted_frames')
      .eq('id', projectId)
      .maybeSingle();
      
    if (projectError) {
      console.error("Error fetching project extracted_frames:", projectError);
      return;
    }
    
    let allFrames: ExtractedFrame[] = [];
    
    // Combine with existing frames if available
    if (project?.extracted_frames && Array.isArray(project.extracted_frames)) {
      const existingFrames = project.extracted_frames as unknown as ExtractedFrame[];
      
      // Remove placeholders and frames with the same timestamp
      allFrames = existingFrames.filter(existing => 
        !existing.isPlaceholder && // Remove all placeholders
        !newFrames.some(newFrame => newFrame.timestamp === existing.timestamp) // Remove if we have a new frame with the same timestamp
      );
      
      console.log(`Found ${existingFrames.length} existing frames, keeping ${allFrames.length} after filtering`);
      
      // Add the new frames
      allFrames = [...allFrames, ...newFrames];
    } else {
      allFrames = newFrames;
    }
    
    // Save the extracted frames to the project
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        extracted_frames: allFrames
      })
      .eq('id', projectId);
      
    if (updateError) {
      console.error("Error updating project with extracted frames:", updateError);
      toast.error("Failed to save extracted frames to project");
    } else {
      console.log(`Successfully saved ${allFrames.length} extracted frames to project ${projectId}`);
    }
  } catch (error) {
    console.error("Error in updateProjectWithExtractedFrames:", error);
  }
}

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
    await updateProjectWithExtractedFrames(projectId, extractedFrames);
    
    // Update the slides if present
    if (project.slides && Array.isArray(project.slides)) {
      const updatedSlides = project.slides.map((slide: any) => {
        // If slide has a timestamp, find the matching frame
        if (slide.timestamp) {
          const matchingFrame = extractedFrames.find(frame => 
            frame.timestamp === slide.timestamp && !frame.isPlaceholder
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
              extractedFrames.find(frame => frame.timestamp === timestamp && !frame.isPlaceholder)
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
        toast.error("Failed to update slides with extracted frames");
        return false;
      }
      
      console.log(`Successfully updated project slides with extracted frames`);
    }
    
    return true;
  } catch (error) {
    console.error("Error updating slides with extracted frames:", error);
    toast.error(`Failed to update slides: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};
