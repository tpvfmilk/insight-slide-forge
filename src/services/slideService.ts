
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Slide } from "@/hooks/useSlides";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

/**
 * Load slides for a project
 */
export const loadProjectSlides = async (projectId: string): Promise<Slide[]> => {
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('slides')
      .eq('id', projectId)
      .single();
      
    if (project && project.slides && Array.isArray(project.slides)) {
      const slidesData = project.slides as unknown as Slide[];
      if (slidesData.length > 0) {
        return slidesData;
      }
    }
    
    // Default placeholder slide if no slides exist
    return [{
      id: "slide-placeholder",
      title: "Generate Your Slides",
      content: "Click the 'Generate Slides' button to process your content and create presentation slides."
    }];
  } catch (error) {
    console.error("Error loading project slides:", error);
    toast.error("Failed to load slides");
    
    // Default placeholder on error
    return [{
      id: "slide-placeholder",
      title: "Generate Your Slides",
      content: "Click the 'Generate Slides' button to process your content and create presentation slides."
    }];
  }
};

/**
 * Update slides in the database
 */
export const updateSlidesInDatabase = async (projectId: string, slides: Slide[]): Promise<boolean> => {
  if (!projectId) return false;
  
  try {
    const { error } = await supabase
      .from('projects')
      .update({
        slides: slides as any,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating slides in database:", error);
    return false;
  }
};

/**
 * Remove an image from a slide
 */
export const removeImageFromSlide = async (
  projectId: string,
  slideIndex: number,
  imageUrl: string,
  slides: Slide[]
): Promise<Slide[]> => {
  const updatedSlides = [...slides];
  const currentImageUrls = updatedSlides[slideIndex].imageUrls;
  
  if (currentImageUrls) {
    // Remove from imageUrls array
    updatedSlides[slideIndex] = {
      ...updatedSlides[slideIndex],
      imageUrls: currentImageUrls.filter(url => url !== imageUrl)
    };
  } else if (updatedSlides[slideIndex].imageUrl === imageUrl) {
    // Remove from single imageUrl
    updatedSlides[slideIndex] = {
      ...updatedSlides[slideIndex],
      imageUrl: undefined
    };
  }
  
  // Update in database
  const success = await updateSlidesInDatabase(projectId, updatedSlides);
  
  if (success) {
    toast.success("Image removed from slide");
  } else {
    toast.error("Failed to remove image from slide");
  }
  
  return updatedSlides;
};

/**
 * Add an image to a slide
 */
export const addImageToSlide = async (
  projectId: string,
  slideIndex: number,
  imageUrl: string,
  slides: Slide[]
): Promise<Slide[]> => {
  const updatedSlides = [...slides];
  
  // Check if the slide already has images
  if (updatedSlides[slideIndex].imageUrls && updatedSlides[slideIndex].imageUrls!.length > 0) {
    // Add to the existing imageUrls array
    updatedSlides[slideIndex] = {
      ...updatedSlides[slideIndex],
      imageUrls: [...updatedSlides[slideIndex].imageUrls!, imageUrl]
    };
  } else if (updatedSlides[slideIndex].imageUrl) {
    // Convert from single imageUrl to imageUrls array
    updatedSlides[slideIndex] = {
      ...updatedSlides[slideIndex],
      imageUrls: [updatedSlides[slideIndex].imageUrl!, imageUrl],
      imageUrl: undefined // Clear the single imageUrl
    };
  } else {
    // First image for this slide
    updatedSlides[slideIndex] = {
      ...updatedSlides[slideIndex],
      imageUrls: [imageUrl]
    };
  }
  
  // Update in database
  const success = await updateSlidesInDatabase(projectId, updatedSlides);
  
  if (!success) {
    toast.error("Failed to add image to slide");
  }
  
  return updatedSlides;
};

/**
 * Create a new slide
 */
export const createNewSlide = (
  currentIndex: number,
  slides: Slide[]
): {updatedSlides: Slide[], newIndex: number} => {
  const newSlide: Slide = {
    id: `slide-${Date.now()}`,
    title: "New Slide",
    content: "Add your content here..."
  };
  
  // Insert new slide after current slide
  const updatedSlides = [...slides];
  updatedSlides.splice(currentIndex + 1, 0, newSlide);
  
  return {
    updatedSlides,
    newIndex: currentIndex + 1
  };
};

/**
 * Delete a slide
 */
export const deleteSlide = (
  index: number,
  slides: Slide[]
): {updatedSlides: Slide[], deletedSlide: Slide, newIndex: number} => {
  // Don't delete if it's the only slide
  if (slides.length <= 1) {
    toast.error("Cannot delete the only slide");
    return {
      updatedSlides: slides,
      deletedSlide: slides[index],
      newIndex: index
    };
  }
  
  // Store the deleted slide for potential undo
  const deletedSlide = slides[index];
  
  // Remove the slide from the array
  const updatedSlides = slides.filter((_, i) => i !== index);
  
  // Calculate new index
  let newIndex = index;
  if (index >= updatedSlides.length) {
    newIndex = updatedSlides.length - 1;
  }
  
  return {
    updatedSlides,
    deletedSlide,
    newIndex
  };
};

/**
 * Restore a deleted slide
 */
export const restoreDeletedSlide = (
  index: number,
  slide: Slide,
  slides: Slide[]
): Slide[] => {
  const updatedSlides = [...slides];
  updatedSlides.splice(index, 0, slide);
  return updatedSlides;
};

/**
 * Apply selected frames to a slide
 */
export const applyFramesToSlide = async (
  projectId: string, 
  slideIndex: number,
  frames: ExtractedFrame[],
  slides: Slide[]
): Promise<Slide[]> => {
  const updatedSlides = [...slides];
  
  // Update the slide with the selected frames' URLs
  updatedSlides[slideIndex] = {
    ...updatedSlides[slideIndex],
    imageUrls: frames.map(frame => frame.imageUrl)
  };
  
  // Update in database
  const success = await updateSlidesInDatabase(projectId, updatedSlides);
  
  if (success) {
    toast.success(`Applied ${frames.length} frame(s) to slide`);
  } else {
    toast.error("Failed to apply frames to slide");
  }
  
  return updatedSlides;
};
