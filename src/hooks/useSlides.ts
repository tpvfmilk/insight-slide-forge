
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjectById } from "@/services/projectService";
import { getProjectTotalSize } from "@/services/storageService";
import { generateSlidesForProject } from "@/services/slideGenerationService";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

// Define the Slide interface to be used across components
export interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
  imageUrls?: string[];
  transcriptTimestamps?: string[];
}

// Interface to be compatible with ExtractedFrame
export interface LocalExtractedFrame extends ExtractedFrame {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}

export const useSlides = (projectId?: string) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [editedTitle, setEditedTitle] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [allExtractedFrames, setAllExtractedFrames] = useState<LocalExtractedFrame[]>([]);
  const [videoPath, setVideoPath] = useState<string>("");
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [lastDeletedSlide, setLastDeletedSlide] = useState<Slide | null>(null);
  const [showUndoButton, setShowUndoButton] = useState<boolean>(false);
  const [projectSize, setProjectSize] = useState<number>(0);
  const [videoMetadata, setVideoMetadata] = useState<{
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  } | null>(null);
  const [isSyncingFrames, setIsSyncingFrames] = useState<boolean>(false);

  // Get the current slide
  const currentSlide = slides[currentSlideIndex];
  
  // Add function to fetch project size
  const fetchProjectSize = useCallback(async () => {
    if (!projectId) return;
    try {
      const size = await getProjectTotalSize(projectId);
      setProjectSize(size);
    } catch (error) {
      console.error("Error fetching project size:", error);
    }
  }, [projectId]);
  
  // Load all frames from the project
  const loadFramesFromProject = useCallback(async () => {
    if (!projectId) return [];
    
    try {
      console.log("Loading frames from project database...");
      const { data: project } = await supabase
        .from('projects')
        .select('extracted_frames')
        .eq('id', projectId)
        .single();
      
      if (project && project.extracted_frames && Array.isArray(project.extracted_frames)) {
        // Transform the API ExtractedFrame format to our local format with proper type compliance
        const frames = (project.extracted_frames as unknown as ExtractedFrame[])
          .filter(frame => frame && frame.imageUrl && !frame.imageUrl.startsWith('blob:'))
          .map(frame => ({
            ...frame,
            imageUrl: frame.imageUrl,
            timestamp: frame.timestamp,
            id: frame.id || `frame-${frame.timestamp?.replace(/:/g, "-")}-${Date.now()}` // Generate a unique ID if not present
          })) as LocalExtractedFrame[];
        
        console.log(`Loaded ${frames.length} frames from project database`);
        setAllExtractedFrames(frames);
        return frames;
      }
      return [];
    } catch (error) {
      console.error("Error loading frames from project:", error);
      return [];
    }
  }, [projectId]);
  
  const loadProject = async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const project = await fetchProjectById(projectId);
      if (!project) {
        toast.error("Project not found");
        return;
      }
      setProjectTitle(project.title || "Untitled Project");

      // Store video path for frame extraction
      if (project.source_type === 'video' && project.source_file_path) {
        setVideoPath(project.source_file_path);
      }

      // Set video metadata
      if (project.video_metadata) {
        setVideoMetadata(project.video_metadata);
      }

      // Load all extracted frames - this is a critical step for frame persistence
      await loadFramesFromProject();
      
      if (project.slides && Array.isArray(project.slides)) {
        // Convert from Json to Slide array with proper type checking
        const slidesData = project.slides as unknown as Slide[];
        if (slidesData.length > 0) {
          setSlides(slidesData);

          // Collect all timestamps for potential frame extraction
          const allTimestamps: string[] = [];
          slidesData.forEach(slide => {
            if (slide.timestamp) {
              allTimestamps.push(slide.timestamp);
            }
            if (Array.isArray(slide.transcriptTimestamps)) {
              slide.transcriptTimestamps.forEach(ts => {
                if (typeof ts === 'string') {
                  allTimestamps.push(ts);
                }
              });
            }
          });

          // Remove duplicates
          setTimestamps([...new Set(allTimestamps)]);
        } else {
          // Default placeholder slide if slides array is empty
          setSlides([{
            id: "slide-placeholder",
            title: "Generate Your Slides",
            content: "Click the 'Generate Slides' button to process your content and create presentation slides."
          }]);
        }
      } else {
        // Default placeholder slide if no slides exist yet
        setSlides([{
          id: "slide-placeholder",
          title: "Generate Your Slides",
          content: "Click the 'Generate Slides' button to process your content and create presentation slides."
        }]);
      }
      
      // Fetch project size
      fetchProjectSize();
    } catch (error) {
      console.error("Error loading project slides:", error);
      toast.error("Failed to load project");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to synchronize frames with the database
  const syncFramesWithDatabase = async (frames: LocalExtractedFrame[]): Promise<void> => {
    if (!projectId) return;
    
    try {
      setIsSyncingFrames(true);
      console.log(`Syncing ${frames.length} frames with database...`);
      
      // Store frames in the project's extracted_frames field in the database
      const { error } = await supabase
        .from('projects')
        .update({ 
          extracted_frames: frames,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      if (error) {
        console.error("Error syncing frames with database:", error);
        throw error;
      }
      
      console.log(`Successfully synchronized ${frames.length} frames with database`);
    } catch (error) {
      console.error("Error in syncFramesWithDatabase:", error);
      toast.error("Failed to synchronize frames with database");
    } finally {
      setIsSyncingFrames(false);
    }
  };
  
  const generateSlides = async () => {
    if (!projectId) return;
    try {
      setIsGenerating(true);
      toast.loading("Generating slides...", {
        id: "generate-slides"
      });
      
      // Use the shared function from slideGenerationService
      const result = await generateSlidesForProject(projectId);
      
      if (result.success && result.slides) {
        // Update slides with the generated content
        setSlides(result.slides);
        setCurrentSlideIndex(0);
        
        // Update edited fields with the first slide
        if (result.slides[0]) {
          setEditedTitle(result.slides[0].title);
          setEditedContent(result.slides[0].content);
        }
        
        toast.success(`${result.slides.length} slides generated successfully!`, {
          id: "generate-slides"
        });
        
        // Update project size after generation
        fetchProjectSize();
      } else {
        throw new Error("Failed to generate slides");
      }
    } catch (error) {
      console.error("Error generating slides:", error);
      toast.error(`Failed to generate slides: ${error.message}`, {
        id: "generate-slides"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Merge frames with the global frame library
  const mergeFramesWithLibrary = async (newFrames: ExtractedFrame[]): Promise<LocalExtractedFrame[]> => {
    // Create a map with all existing frames for efficient lookup
    const frameMap = new Map<string, LocalExtractedFrame>();
    
    // First add all existing frames from our state
    allExtractedFrames.forEach(frame => {
      if (frame.id) {
        frameMap.set(frame.id, frame);
      }
    });
    
    // Add or update with new frames
    const processedNewFrames = newFrames.map(frame => {
      // Ensure all frames have an id
      const frameId = frame.id || `frame-${frame.timestamp?.replace(/:/g, "-")}-${Date.now()}`;
      
      return {
        ...frame,
        id: frameId
      } as LocalExtractedFrame;
    });
    
    processedNewFrames.forEach(frame => {
      if (frame.id) {
        frameMap.set(frame.id, frame);
      }
    });
    
    // Convert map back to array
    const mergedFrames = Array.from(frameMap.values());
    console.log(`Merged to ${mergedFrames.length} total frames in library`);
    
    // Update our state
    setAllExtractedFrames(mergedFrames);
    
    return mergedFrames;
  };
  
  // goToSlide function with frame state persistence
  const goToSlide = async (index: number) => {
    if (index !== currentSlideIndex) {
      // Save any pending changes first
      saveChanges();
      
      // Set the new slide index
      setCurrentSlideIndex(index);
      
      // Refresh frame data to ensure we have the latest
      try {
        await loadFramesFromProject();
      } catch (error) {
        console.error("Error refreshing frames when changing slide:", error);
        // Continue without blocking the slide change
      }
    }
  };
  
  const goToNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  };
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  };
  
  const saveChanges = () => {
    if (isEditing) {
      const updatedSlides = [...slides];
      updatedSlides[currentSlideIndex] = {
        ...updatedSlides[currentSlideIndex],
        title: editedTitle,
        content: editedContent
      };
      setSlides(updatedSlides);

      // Also update in the database
      updateSlidesInDatabase(updatedSlides);
      setIsEditing(false);
    }
  };
  
  const updateSlidesInDatabase = async (updatedSlides: Slide[]) => {
    if (!projectId) return;
    try {
      // Ensure we're passing the slides in a format compatible with Json type
      const {
        error
      } = await supabase.from('projects').update({
        slides: updatedSlides as any,
        updated_at: new Date().toISOString()
      }).eq('id', projectId);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating slides in database:", error);
      // We don't show a toast here since it's a background operation
    }
  };
  
  const startEditing = () => {
    setIsEditing(true);
  };
  
  // Remove an image from a slide
  const removeImage = async (imageUrl: string) => {
    const updatedSlides = [...slides];
    const currentImageUrls = updatedSlides[currentSlideIndex].imageUrls;
    
    if (currentImageUrls) {
      // Remove from imageUrls array
      updatedSlides[currentSlideIndex] = {
        ...updatedSlides[currentSlideIndex],
        imageUrls: currentImageUrls.filter(url => url !== imageUrl)
      };
    } else if (updatedSlides[currentSlideIndex].imageUrl === imageUrl) {
      // Remove from single imageUrl
      updatedSlides[currentSlideIndex] = {
        ...updatedSlides[currentSlideIndex],
        imageUrl: undefined
      };
    }
    
    setSlides(updatedSlides);
    await updateSlidesInDatabase(updatedSlides);
    toast.success("Image removed from slide");
  };
  
  const deleteSlideFromFilmstrip = (event: React.MouseEvent<Element, MouseEvent>, slideIndex: number) => {
    // Stop the click event from propagating to the slide card
    event.stopPropagation();
    
    // Don't delete if it's the only slide
    if (slides.length <= 1) {
      toast.error("Cannot delete the only slide");
      return;
    }
    
    // Store the deleted slide for potential undo
    const deletedSlide = slides[slideIndex];
    
    // Remove the slide from the array
    const updatedSlides = slides.filter((_, index) => index !== slideIndex);
    setSlides(updatedSlides);
    
    // Set current slide index to previous slide if we deleted the current one,
    // or adjust it if we deleted a slide before the current one
    if (slideIndex === currentSlideIndex) {
      // We deleted the current slide, go to previous one
      const newIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : 0;
      setCurrentSlideIndex(newIndex);
    } else if (slideIndex < currentSlideIndex) {
      // We deleted a slide before the current one, adjust the index
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
    
    // Save the deleted slide for undo
    setLastDeletedSlide(deletedSlide);
    setShowUndoButton(true);
    
    // Update slides in database
    updateSlidesInDatabase(updatedSlides);
    
    toast.success("Slide deleted", {
      action: {
        label: "Undo",
        onClick: undoDeleteSlide
      }
    });
  };

  // Delete current slide function
  const deleteCurrentSlide = () => {
    // Create a synthetic event to pass to deleteSlideFromFilmstrip
    const syntheticEvent = {
      stopPropagation: () => {}
    } as React.MouseEvent<Element, MouseEvent>;
    
    deleteSlideFromFilmstrip(syntheticEvent, currentSlideIndex);
  };

  const addNewSlide = () => {
    // Save current changes before adding a new slide
    saveChanges();
    
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: "New Slide",
      content: "Add your content here..."
    };
    
    // Insert new slide after current slide
    const updatedSlides = [...slides];
    updatedSlides.splice(currentSlideIndex + 1, 0, newSlide);
    setSlides(updatedSlides);
    
    // Navigate to the new slide
    setCurrentSlideIndex(currentSlideIndex + 1);
    
    // Update slides in database
    updateSlidesInDatabase(updatedSlides);
    
    toast.success("New slide added");
  };
  
  const undoDeleteSlide = () => {
    if (!lastDeletedSlide) return;
    
    const updatedSlides = [...slides];
    updatedSlides.splice(currentSlideIndex, 0, lastDeletedSlide);
    setSlides(updatedSlides);
    
    // Update slides in database
    updateSlidesInDatabase(updatedSlides);
    
    setLastDeletedSlide(null);
    setShowUndoButton(false);
    
    toast.success("Slide restored");
  };
  
  // Load project on initial mount
  useEffect(() => {
    loadProject();
  }, [projectId]);
  
  // Update edited fields when current slide changes
  useEffect(() => {
    if (currentSlide) {
      setEditedTitle(currentSlide.title);
      setEditedContent(currentSlide.content);
    }
  }, [currentSlide, currentSlideIndex]);
  
  // Auto-hide undo button after 10 seconds
  useEffect(() => {
    if (showUndoButton) {
      const timer = setTimeout(() => {
        setShowUndoButton(false);
      }, 10000); // 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [showUndoButton]);
  
  return {
    slides,
    setSlides,
    currentSlideIndex,
    setCurrentSlideIndex,
    currentSlide,
    editedTitle,
    setEditedTitle,
    editedContent,
    setEditedContent,
    isEditing,
    setIsEditing,
    isLoading,
    isGenerating,
    projectTitle,
    allExtractedFrames,
    videoPath,
    timestamps,
    lastDeletedSlide,
    showUndoButton,
    projectSize,
    videoMetadata,
    isSyncingFrames,
    // Functions
    loadProject,
    goToSlide,
    goToNextSlide,
    goToPrevSlide,
    saveChanges,
    startEditing,
    generateSlides,
    addNewSlide,
    deleteCurrentSlide,
    deleteSlideFromFilmstrip,
    undoDeleteSlide,
    loadFramesFromProject,
    syncFramesWithDatabase,
    updateSlidesInDatabase,
    mergeFramesWithLibrary,
    removeImage
  };
};
