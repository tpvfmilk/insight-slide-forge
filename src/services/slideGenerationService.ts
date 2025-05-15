
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Check if a project has valid slides
export function hasValidSlides(project: any): boolean {
  return project?.slides && Array.isArray(project.slides) && project.slides.length > 0;
}

// Generate slides using the project's transcript
export const generateSlidesForProject = async (projectId: string): Promise<{
  success: boolean;
  slides?: any[];
  error?: string;
}> => {
  try {
    // Fetch the most recent project data to ensure we have the latest transcript
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project) {
      console.error("Error fetching project:", projectError);
      throw new Error("Failed to fetch project data");
    }
    
    if (!project.transcript) {
      throw new Error("No transcript available. Please transcribe the video first.");
    }
    
    // Check if the transcript is excessively large and might cause issues
    if (project.transcript && project.transcript.length > 100000) {
      console.warn("Large transcript detected, performance may be affected");
    }
    
    // Set a default target slide count if not specified
    const targetSlides = project.target_slide_count || 10;
    
    // Call the Edge Function to generate slides
    const { data, error } = await supabase.functions.invoke('generate-slides', {
      body: {
        projectId,
        transcript: project.transcript,
        targetSlideCount: targetSlides,
        contextPrompt: project.context_prompt || "",
        projectTitle: project.title || "Untitled Project",
        videoDuration: project.video_metadata?.duration || 0
      }
    });
    
    if (error) {
      console.error("Error generating slides:", error);
      throw new Error(`Failed to generate slides: ${error.message}`);
    }
    
    if (!data || !data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
      throw new Error("No slides were generated. Please try again.");
    }
    
    console.log(`Generated ${data.slides.length} slides`);
    
    // Update project with generated slides
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        slides: data.slides,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    if (updateError) {
      console.error("Error updating project with slides:", updateError);
      throw new Error(`Failed to save generated slides: ${updateError.message}`);
    }
    
    return {
      success: true,
      slides: data.slides
    };
  } catch (error) {
    console.error("Error in generateSlidesForProject:", error);
    toast.error(error.message || "Failed to generate slides");
    return {
      success: false,
      error: error.message
    };
  }
};

// Additional utility functions as needed
export const countSlidesWithImages = (slides: any[]): number => {
  if (!slides || !Array.isArray(slides)) return 0;
  return slides.filter(slide => slide && slide.image).length;
};

export const countSlidesWithoutImages = (slides: any[]): number => {
  if (!slides || !Array.isArray(slides)) return 0;
  return slides.filter(slide => slide && !slide.image).length;
};
