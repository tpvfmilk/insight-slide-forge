
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Project } from "@/services/projectService";
import { extractFramesFromVideo, mapTimestampsToImages } from "@/services/frameExtractionService";
import { initializeStorage } from "@/services/storageService";
import { fetchProjectVideos } from "@/services/projectVideoService";

/**
 * Default context prompt for slide generation - provides detailed guidelines for OpenAI
 */
const DEFAULT_CONTEXT_PROMPT = `You are an AI assistant that generates presentation slides from a transcript of a video. Your goal is to break the transcript into structured, clear, and accurate slide content for a study or review presentation.

# 🎯 Objective:
Create PowerPoint-style slides that:
- Are directly based on the transcript
- Present ideas in the **same order** as they appear in the transcript
- Are factually and structurally faithful to the original video content

---

## 📘 Slide Types:

### 1. Content Slides
- Break the transcript into logical topic-based slides
- Maintain the **sequential flow of information** from the transcript (do not reorder concepts)
- Each content slide must include:
  - A concise **title** (4–10 words max)
  - **2 to 5 bullet points** summarizing the portion of the transcript in **the order they were spoken**
  - Bullet points should be paraphrased or quoted directly from the transcript, not reordered
-Be detailed and accurate.
-Do not create an title sheet or conclusion sheet.

---

### 2. Question Slides (Only if questions are in the transcript)

#### A. Multiple Choice Questions (MCQs)
If transcript includes MCQs:
- **Slide 1**: Display the question and choices (A–D format)
- **Slide 2**: Show the correct answer:
  - Format: "✅ Correct Answer: C"
  - Add 1–2 sentence explanation from transcript
- **Slide 3+**: Explanation slides using adjacent transcript content in original sequence

#### B. Direct-Answer Questions
If a non-multiple-choice question is in the transcript:
- **Slide 1**: Show the question
- **Slide 2**: Display "✅ Correct Answer:" with the **verbatim** or most accurate transcript-derived answer
  - Include 1–2 sentence explanation
- **Slide 3+**: Follow-up explanation slides if transcript supports more elaboration

---

### 3. Explanation Slides
- Use **only if** transcript contains further clarification or expansion
- Follow original transcript sequence
- Each explanation slide must include:
  - A relevant title
  - 2–5 bullet points
  - Bullet points must be based on **consecutive transcript content**, not grouped by topic from different parts

---

## ⚠️ Rules:
- ❌ Do NOT reorder information from different parts of the transcript to fit a theme
- ❌ Do NOT add outside knowledge or invented explanations
- ✅ Slide content must reflect the **order and timing** of the transcript/video
- ✅ If something is explained later, that explanation should appear **after** the first mention


# 📌 Summary:
> All slides must follow the **transcript's natural order**, slide-by-slide. Do not move answers or concepts forward in the deck if they are only explained later in the transcript. Stay accurate. Stay sequential.`;

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
    
    // Fetch the project to get context_prompt if available
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('context_prompt, transcript, source_type, source_file_path, video_metadata, title')
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
      videoDuration: totalVideoDuration,
      presentationTitle: project?.title || 'Presentation'
    });
    
    // Include additional parameters in the API call
    // Now we'll pass our default context prompt if the user hasn't provided one
    const response = await supabase.functions.invoke('generate-slides', {
      body: {
        projectId,
        contextPrompt: project?.context_prompt || '',
        defaultContextPrompt: DEFAULT_CONTEXT_PROMPT, // Pass the default context prompt
        videoDuration: totalVideoDuration,
        presentationTitle: project?.title || 'Presentation'
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
