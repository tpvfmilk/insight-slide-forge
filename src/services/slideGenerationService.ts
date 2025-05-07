
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Project } from "@/services/projectService";
import { extractFramesFromVideo } from "@/services/frameExtractionService";

/**
 * Initiates the slide generation process for a project
 * @param projectId ID of the project for which to generate slides
 * @returns Object containing success status and generated slides if successful
 */
export const generateSlidesForProject = async (projectId: string): Promise<{ success: boolean; slides?: any[] }> => {
  try {
    toast.loading("Generating slides...", { id: "generate-slides" });
    
    // Fetch the project to get context_prompt and slides_per_minute if available
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('context_prompt, transcript, source_type, slides_per_minute, source_file_path')
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
    
    const response = await fetch(`https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/generate-slides`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        projectId,
        contextPrompt: project?.context_prompt || '',
        slidesPerMinute: project?.slides_per_minute || 6
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
    
    toast.success("Slides generated successfully!", { id: "generate-slides" });
    
    // If this is a video source, extract frames for slides with timestamps
    if (project.source_type === 'video' && project.source_file_path) {
      // Filter out slides with valid timestamps
      const slidesWithTimestamps = generatedSlides.filter(slide => slide.timestamp && typeof slide.timestamp === 'string');
      
      if (slidesWithTimestamps.length > 0) {
        const timestamps = slidesWithTimestamps.map(slide => slide.timestamp);
        console.log("Extracting frames for timestamps:", timestamps);
        
        // Extract frames in the background without waiting
        extractFramesFromVideo(projectId, project.source_file_path, timestamps)
          .then(result => {
            if (result.success) {
              console.log("Frames extracted successfully:", result.frames);
            }
          })
          .catch(error => {
            console.error("Error extracting frames:", error);
          });
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
