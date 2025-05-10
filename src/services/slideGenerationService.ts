
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Project } from "@/services/projectService";
import { extractFramesFromVideo, mapTimestampsToImages } from "@/services/frameExtractionService";
import { initializeStorage } from "@/services/storageService";
import { fetchProjectVideos } from "@/services/projectVideoService";

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
    
    // Get all videos in the project to calculate total duration
    const projectVideos = await fetchProjectVideos(projectId);
    let totalVideoDuration = 0;
    
    // Calculate total duration from all project videos
    if (projectVideos.length > 0) {
      totalVideoDuration = projectVideos.reduce((total, video) => {
        const duration = video.video_metadata?.duration || 0;
        return total + duration;
      }, 0);
      
      console.log(`Total duration across all ${projectVideos.length} videos: ${totalVideoDuration}s`);
    } else if (project.source_type === 'video' && project.video_metadata) {
      // Fallback to the main video's metadata
      try {
        const metadata = project.video_metadata as { duration?: number };
        if (metadata.duration) {
          totalVideoDuration = metadata.duration;
          console.log(`Using main video duration for slide generation: ${totalVideoDuration}s`);
        }
      } catch (error) {
        console.warn('Could not extract video duration from metadata:', error);
      }
    }

    console.log("Calling generate-slides edge function with params:", {
      projectId,
      contextPrompt: project?.context_prompt || '',
      slidesPerMinute: project?.slides_per_minute || 6, 
      videoDuration: totalVideoDuration
    });
    
    const response = await supabase.functions.invoke('generate-slides', {
      body: {
        projectId,
        contextPrompt: project?.context_prompt || '',
        slidesPerMinute: project?.slides_per_minute || 6,
        videoDuration: totalVideoDuration // Pass total video duration to the edge function
      }
    });
    
    if (response.error) {
      console.error("Error from generate-slides edge function:", response.error);
      throw new Error(response.error.message || "Failed to generate slides");
    }
    
    const { slides: generatedSlides } = response.data || {};
    
    if (!generatedSlides || !Array.isArray(generatedSlides) || generatedSlides.length === 0) {
      throw new Error("No slides were generated");
    }
    
    console.log(`Generated ${generatedSlides.length} slides successfully`);
    toast.success(`Generated ${generatedSlides.length} slides successfully!`, { id: "generate-slides" });
    
    // If this is a video source, inform the user that they need to manually extract frames
    if (project.source_type === 'video' && project.source_file_path) {
      // Collect all timestamps from all slides
      const allTimestamps = generatedSlides.reduce((timestamps, slide) => {
        if (slide.transcriptTimestamps && Array.isArray(slide.transcriptTimestamps)) {
          return [...timestamps, ...slide.transcriptTimestamps];
        } else if (slide.timestamp && typeof slide.timestamp === 'string') {
          return [...timestamps, slide.timestamp];
        }
        return timestamps;
      }, []);
      
      if (allTimestamps.length > 0) {
        console.log("Slides contain timestamps for manual frame extraction:", allTimestamps);
        toast.info("Slides generated. You can now manually extract frames for your slides.", { id: "generate-slides" });
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
