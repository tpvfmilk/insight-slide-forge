import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

// Helper function to safely extract duration from video metadata
function getVideoDurationFromMetadata(metadata: Json | null): number | undefined {
  if (!metadata) return undefined;
  
  try {
    if (typeof metadata === 'object') {
      // First try to get it directly
      if ('duration' in metadata && typeof metadata.duration === 'number') {
        return metadata.duration;
      }
      
      // Then try from chunked_video_metadata
      if ('chunked_video_metadata' in metadata && 
          typeof metadata.chunked_video_metadata === 'object' &&
          metadata.chunked_video_metadata !== null) {
        const chunkedMeta = metadata.chunked_video_metadata;
        if ('originalDuration' in chunkedMeta && 
            typeof chunkedMeta.originalDuration === 'number') {
          return chunkedMeta.originalDuration;
        }
      }
    }
    return undefined;
  } catch (e) {
    console.error("Error extracting duration from metadata:", e);
    return undefined;
  }
}

export const generateSlides = async (
  projectId: string,
  contextPrompt: string,
  transcript: string,
  openAIApiKey: string,
  slideCount: number = 10
): Promise<boolean> => {
  try {
    // Fetch the project to get video metadata
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('video_metadata')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error("Error fetching project for video metadata:", projectError);
      return false;
    }

    // Safely extract video duration from metadata
    const videoDuration = getVideoDurationFromMetadata(project.video_metadata) || 0;

    const response = await fetch('/api/generateSlides', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId, contextPrompt, transcript, openAIApiKey, slideCount, videoDuration }),
    });

    if (!response.ok) {
      console.error('Slide generation failed:', response.statusText);
      return false;
    }

    const data = await response.json();

    if (data.success) {
      console.log('Slides generated successfully');
      return true;
    } else {
      console.error('Slide generation failed on server:', data.error);
      return false;
    }
  } catch (error) {
    console.error('Error during slide generation:', error);
    return false;
  }
};

export const hasValidSlides = (project: any): boolean => {
  if (!project || !project.slides || !Array.isArray(project.slides)) {
    return false;
  }

  return project.slides.length > 0;
};
