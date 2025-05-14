import React, { createContext, useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjectById } from "@/services/projectService";
import { uploadSlideImage } from "@/services/imageService";
import { generateSlidesForProject } from "@/services/slideGenerationService";
import { getProjectTotalSize } from "@/services/storageService";
import { 
  Slide, 
  LocalExtractedFrame, 
  SlideEditorContextValue,
  ExportState
} from "./SlideEditorTypes";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";

interface SlideEditorContextProps {
  children: React.ReactNode;
}

export const SlideEditorContext = createContext<SlideEditorContextValue | undefined>(undefined);

export const SlideEditorProvider: React.FC<SlideEditorContextProps> = ({ children }) => {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const projectId = routeProjectId || "";
  
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [editedTitle, setEditedTitle] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<ExportState>({
    pdf: false,
    anki: false,
    csv: false
  });
  const [isFrameSelectorOpen, setIsFrameSelectorOpen] = useState<boolean>(false);
  const [allExtractedFrames, setAllExtractedFrames] = useState<LocalExtractedFrame[]>([]);
  const [videoPath, setVideoPath] = useState<string>("");
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [lastDeletedSlide, setLastDeletedSlide] = useState<Slide | null>(null);
  const [showUndoButton, setShowUndoButton] = useState<boolean>(false);
  const [projectSize, setProjectSize] = useState<number>(0);
  const [isFramePickerModalOpen, setIsFramePickerModalOpen] = useState<boolean>(false);
  const [videoMetadata, setVideoMetadata] = useState<{
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  } | null>(null);
  
  const currentSlide = slides[currentSlideIndex] || null;
  
  // Fetch project size
  const fetchProjectSize = useCallback(async () => {
    if (!projectId) return;
    try {
      const size = await getProjectTotalSize(projectId);
      setProjectSize(size);
    } catch (error) {
      console.error("Error fetching project size:", error);
    }
  }, [projectId]);
  
  // Load project data
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

      // Load all extracted frames
      if (project.extracted_frames && Array.isArray(project.extracted_frames)) {
        // Transform the API ExtractedFrame format to our local format with proper type compliance
        const frames = (project.extracted_frames as unknown as ExtractedFrame[]).map(frame => ({
          ...frame,
          imageUrl: frame.imageUrl,
          timestamp: frame.timestamp,
          id: frame.id || `frame-${frame.timestamp.replace(/:/g, "-")}` // Generate a unique ID if not present
        })) as LocalExtractedFrame[];
        setAllExtractedFrames(frames);
      }
      
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
  
  // Auto-hide undo button after 10 seconds
  useEffect(() => {
    if (showUndoButton) {
      const timer = setTimeout(() => {
        setShowUndoButton(false);
      }, 10000); // 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [showUndoButton]);
  
  // Load project on mount
  useEffect(() => {
    loadProject();
  }, [projectId]);
  
  // Update edited title and content when current slide changes
  useEffect(() => {
    if (currentSlide) {
      setEditedTitle(currentSlide.title);
      setEditedContent(currentSlide.content);
    }
  }, [currentSlide, currentSlideIndex]);
  
  // Generate slides function
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
  
  // Handle frame selection
  const handleSelectFrames = () => {
    if (!projectId || !videoPath) {
      toast.warning("No video available for frame selection");
      return;
    }
    
    // Determine which frames are already used in the current slide
    const existingFrames = currentSlide.imageUrls || [];
    if (currentSlide.imageUrl && !existingFrames.includes(currentSlide.imageUrl)) {
      existingFrames.push(currentSlide.imageUrl);
    }
    
    // Filter allExtractedFrames to find the ExtractedFrame objects for these URLs
    const currentSlideFrames = allExtractedFrames.filter(frame => 
      existingFrames.includes(frame.imageUrl)
    );
    
    setIsFramePickerModalOpen(true);
    console.log(`Opening frame picker with ${currentSlideFrames.length} existing frames for this slide`, currentSlideFrames);
  };
  
  // Handle frame selection
  const handleFrameSelection = (selectedFrames: LocalExtractedFrame[]) => {
    if (!selectedFrames.length) {
      return;
    }

    console.log(`Applying ${selectedFrames.length} selected frames to slide #${currentSlideIndex + 1}`, selectedFrames);

    // Update current slide with selected frames
    const updatedSlides = [...slides];
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      imageUrls: selectedFrames.map(frame => frame.imageUrl)
    };
    setSlides(updatedSlides);

    // Also update in the database
    updateSlidesInDatabase(updatedSlides);
    
    // Update project size
    fetchProjectSize();
  };
  
  // Update slides in database
  const updateSlidesInDatabase = async (updatedSlides: Slide[]) => {
    if (!projectId) return;
    try {
      // Ensure we're passing the slides in a format compatible with Json type
      const { error } = await supabase.from('projects').update({
        slides: updatedSlides as any
      }).eq('id', projectId);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating slides in database:", error);
      // We don't show a toast here since it's a background operation
    }
  };
  
  // Navigation functions
  const goToSlide = (index: number) => {
    if (index !== currentSlideIndex) {
      saveChanges();
      setCurrentSlideIndex(index);
    }
  };
  
  const goToNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      saveChanges();
      setCurrentSlideIndex(prev => prev + 1);
    }
  };
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0) {
      saveChanges();
      setCurrentSlideIndex(prev => prev - 1);
    }
  };
  
  // Save changes to current slide
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
  
  // Start editing the current slide
  const startEditing = () => {
    setIsEditing(true);
  };
  
  // Copy slide content to clipboard
  const copyToClipboard = () => {
    const slideText = `${currentSlide.title}\n\n${currentSlide.content}`;
    navigator.clipboard.writeText(slideText);
  };
  
  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const file = event.target.files[0];
    try {
      setIsUploadingImage(true);
      toast.loading("Uploading image...", {
        id: "upload-image"
      });
      const uploadResult = await uploadSlideImage(file);
      if (!uploadResult) {
        throw new Error("Failed to upload image");
      }

      // Update the current slide with the image URL
      const updatedSlides = [...slides];

      // Check if the slide already has images
      if (updatedSlides[currentSlideIndex].imageUrls && updatedSlides[currentSlideIndex].imageUrls!.length > 0) {
        // Add to the existing imageUrls array
        updatedSlides[currentSlideIndex] = {
          ...updatedSlides[currentSlideIndex],
          imageUrls: [...updatedSlides[currentSlideIndex].imageUrls!, uploadResult.url]
        };
      } else if (updatedSlides[currentSlideIndex].imageUrl) {
        // Convert from single imageUrl to imageUrls array
        updatedSlides[currentSlideIndex] = {
          ...updatedSlides[currentSlideIndex],
          imageUrls: [updatedSlides[currentSlideIndex].imageUrl!, uploadResult.url],
          imageUrl: undefined // Clear the single imageUrl
        };
      } else {
        // First image for this slide
        updatedSlides[currentSlideIndex] = {
          ...updatedSlides[currentSlideIndex],
          imageUrls: [uploadResult.url]
        };
      }
      setSlides(updatedSlides);
      updateSlidesInDatabase(updatedSlides);
      toast.success("Image uploaded successfully!", {
        id: "upload-image"
      });
      
      // Update project size
      fetchProjectSize();
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(`Failed to upload image: ${error.message}`, {
        id: "upload-image"
      });
    } finally {
      setIsUploadingImage(false);
    }
  };
  
  // Remove image from slide
  const removeImage = (imageUrl: string) => {
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
    updateSlidesInDatabase(updatedSlides);
  };
  
  // Delete slide from filmstrip
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
    
    toast({
      action: {
        label: "Undo",
        onClick: undoDeleteSlide
      }
    });
  };
  
  // Delete current slide
  const deleteCurrentSlide = () => {
    // Create a synthetic event to pass to deleteSlideFromFilmstrip
    const syntheticEvent = {
      stopPropagation: () => {}
    } as React.MouseEvent<Element, MouseEvent>;
    
    deleteSlideFromFilmstrip(syntheticEvent, currentSlideIndex);
  };
  
  // Add new slide
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
  };
  
  // Undo delete slide
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
  
  const value: SlideEditorContextValue = {
    // State
    slides,
    currentSlideIndex,
    currentSlide,
    editedTitle,
    editedContent,
    isEditing,
    isLoading,
    isGenerating,
    projectTitle,
    isUploadingImage,
    isExporting,
    isFrameSelectorOpen,
    allExtractedFrames,
    videoPath,
    timestamps,
    lastDeletedSlide,
    showUndoButton,
    projectSize,
    isFramePickerModalOpen,
    videoMetadata,
    projectId,
    
    // Setters
    setSlides,
    setCurrentSlideIndex,
    setEditedTitle,
    setEditedContent,
    setIsEditing,
    setIsFramePickerModalOpen,
    
    // Methods
    goToSlide,
    goToNextSlide,
    goToPrevSlide,
    saveChanges,
    startEditing,
    copyToClipboard,
    generateSlides,
    handleSelectFrames,
    handleFrameSelection,
    handleImageUpload,
    removeImage,
    deleteSlideFromFilmstrip,
    deleteCurrentSlide,
    addNewSlide,
    undoDeleteSlide,
    updateSlidesInDatabase,
    fetchProjectSize,
  };
  
  return (
    <SlideEditorContext.Provider value={value}>
      {children}
    </SlideEditorContext.Provider>
  );
};

// Custom hook to use the SlideEditor context
export const useSlideEditor = () => {
  const context = React.useContext(SlideEditorContext);
  if (context === undefined) {
    throw new Error("useSlideEditor must be used within a SlideEditorProvider");
  }
  return context;
};
