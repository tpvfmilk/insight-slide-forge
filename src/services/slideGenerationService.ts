
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Project } from "@/services/projectService";
import { extractFramesFromVideo, mapTimestampsToImages } from "@/services/frameExtractionService";
import { initializeStorage } from "@/services/storageService";

/**
 * Initiates the slide generation process for a project
 * @param projectId ID of the project for which to generate slides
 * @returns Object containing success status and generated slides if successful
 */
export const generateSlidesForProject = async (projectId: string): Promise<{ success: boolean; slides?: any[] }> => {
  try {
    // Verify user is authenticated
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      toast.error("You need to be logged in to generate slides", { id: "generate-slides" });
      return { success: false };
    }
    
    toast.loading("Generating slides...", { id: "generate-slides" });
    
    // Ensure storage buckets are initialized before generating slides
    await initializeStorage();
    
    // Fetch the project to get context_prompt and slides_per_minute if available
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('context_prompt, transcript, source_type, slides_per_minute, source_file_path, video_metadata')
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error('Error fetching project context:', projectError);
      throw new Error('Failed to retrieve project details');
    }
    
    // Check if we have transcript for video projects
    if (project.source_type === 'video' && !project.transcript) {
      toast.error("This video needs to be transcribed before generating slides", { id: "generate-slides" });
      return { success: false };
    }
    
    // Get video duration from metadata if it's a video project
    let videoDuration: number | undefined;
    if (project.source_type === 'video' && project.video_metadata) {
      try {
        const metadata = project.video_metadata as { duration?: number };
        if (metadata.duration) {
          videoDuration = metadata.duration;
          console.log(`Video duration for slide generation: ${videoDuration}s`);
        }
      } catch (error) {
        console.warn('Could not extract video duration from metadata:', error);
      }
    }

    console.log("Calling generate-slides edge function");
    const response = await fetch(`https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/generate-slides`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.session.access_token}`
      },
      body: JSON.stringify({
        projectId,
        contextPrompt: project?.context_prompt || '',
        slidesPerMinute: project?.slides_per_minute || 6,
        videoDuration: videoDuration // Pass video duration to the edge function
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate slides");
    }
    
    const { slides: generatedSlides } = await response.json();
    
    if (!generatedSlides || !Array.isArray(generatedSlides) || generatedSlides.length === 0) {
      throw new Error("No slides were generated");
    }
    
    console.log(`Generated ${generatedSlides.length} slides successfully`);
    toast.success(`Generated ${generatedSlides.length} slides successfully!`, { id: "generate-slides" });
    
    // If this is a video source, extract frames for slides with timestamps
    if (project.source_type === 'video' && project.source_file_path) {
      // Collect all timestamps from all slides
      const allTimestamps = generatedSlides.reduce((timestamps, slide) => {
        // Use either transcriptTimestamps array or single timestamp 
        if (slide.transcriptTimestamps && Array.isArray(slide.transcriptTimestamps)) {
          return [...timestamps, ...slide.transcriptTimestamps];
        } else if (slide.timestamp && typeof slide.timestamp === 'string') {
          return [...timestamps, slide.timestamp];
        }
        return timestamps;
      }, []);
      
      if (allTimestamps.length > 0) {
        console.log("Extracting frames for timestamps:", allTimestamps);
        toast.loading("Extracting video frames for slides...", { id: "extract-frames" });
        
        try {
          // Extract frames for all timestamps in one go
          const extractionResult = await extractFramesFromVideo(projectId, project.source_file_path, allTimestamps);
          
          if (extractionResult.success && extractionResult.frames && extractionResult.frames.length > 0) {
            console.log("Frames extracted successfully:", extractionResult.frames);
            
            // Map timestamps to images for each slide
            const slidesWithImages = generatedSlides.map(slide => {
              // Determine which timestamps to use for this slide
              const slideTimestamps = slide.transcriptTimestamps && Array.isArray(slide.transcriptTimestamps) 
                ? slide.transcriptTimestamps 
                : (slide.timestamp ? [slide.timestamp] : []);
              
              if (slideTimestamps.length === 0) {
                console.log(`Slide ${slide.id} has no timestamps`);
                return slide;
              }
              
              // Map timestamps to images
              const imageUrls = mapTimestampsToImages(extractionResult.frames, slideTimestamps);
              
              // If we have new imageUrls array, use it, otherwise keep the existing imageUrl for backward compatibility
              if (imageUrls.length > 0) {
                console.log(`Slide ${slide.id}: Adding ${imageUrls.length} images`);
                return {
                  ...slide,
                  imageUrls
                };
              } else if (slide.timestamp) {
                const matchingFrame = extractionResult.frames.find(frame => frame.timestamp === slide.timestamp);
                if (matchingFrame) {
                  console.log(`Slide ${slide.id}: Adding single image for timestamp ${slide.timestamp}`);
                  return {
                    ...slide,
                    imageUrl: matchingFrame.imageUrl
                  };
                }
              }
              return slide;
            });
            
            // Store the updated slides with images in the database
            try {
              console.log("Saving slides with images to database");
              const { error: updateError } = await supabase
                .from('projects')
                .update({ slides: slidesWithImages })
                .eq('id', projectId);
                
              if (updateError) {
                console.error("Error updating slides with images:", updateError);
                toast.error("Slides were generated but images couldn't be saved", { id: "extract-frames" });
              } else {
                console.log("Successfully updated slides with images in database");
                toast.success("Slides with images were created successfully", { id: "extract-frames" });
              }
            } catch (e) {
              console.error("Failed to save slides with images:", e);
              toast.error("Failed to save slides with images", { id: "extract-frames" });
            }
            
            return { success: true, slides: slidesWithImages };
          } else {
            console.warn("No frames were extracted or extraction failed");
            toast.warning("Slides were generated but frame extraction failed", { id: "extract-frames" });
          }
        } catch (extractionError) {
          console.error("Error during frame extraction:", extractionError);
          toast.error("Slides were generated but frame extraction failed", { id: "extract-frames" });
        }
      } else {
        console.log("No timestamps found in slides, skipping frame extraction");
      }
    }
    
    return { success: true, slides: generatedSlides };
  } catch (error) {
    console.error("Error generating slides:", error);
    toast.error(`Failed to generate slides: ${error.message}`, { id: "generate-slides" });
    return { success: false };
  }
};

/**
 * Type definition for a slide
 */
interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
  transcriptTimestamps?: string[];
  imageUrls?: string[];
}

/**
 * Check if a project has slides already generated
 * @param project The project to check
 * @returns Boolean indicating if valid slides exist
 */
export const hasValidSlides = (project: Project | null): boolean => {
  if (!project) return false;
  
  const slides = project.slides;
  
  // Check if slides array exists and has items
  if (!slides || !Array.isArray(slides) || slides.length === 0) {
    return false;
  }
  
  // Safely check if the first slide is not a placeholder
  const firstSlide = slides[0];
  if (typeof firstSlide === 'object' && firstSlide !== null && 'id' in firstSlide) {
    return firstSlide.id !== "slide-placeholder";
  }
  
  return false;
};
