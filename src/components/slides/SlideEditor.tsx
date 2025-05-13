import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Download, Clock, Image as ImageIcon, RefreshCw, Presentation, Upload, Trash2, Plus, X, Undo, Film } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjectById } from "@/services/projectService";
import { uploadSlideImage } from "@/services/imageService";
import { exportToPDF, exportToCSV, exportToAnki, downloadFile } from "@/services/exportService";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { FrameSelector } from "@/components/slides/FrameSelector";
import { FramePickerModal } from "@/components/video/FramePickerModal";
import { cleanupFrameSelectorDialog } from "@/utils/uiUtils";
import { getProjectTotalSize } from "@/services/storageService";
import { FileSizeBadge } from "@/components/projects/FileSizeBadge";
import { handleManualFrameSelectionComplete, Slide as FrameUtilsSlide, mergeAndSaveFrames } from "@/utils/frameUtils";
import { generateSlidesForProject } from "@/services/slideGenerationService";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define a local interface that ensures id is required 
// while still being compatible with the imported Slide type
interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
  imageUrls?: string[];
  transcriptTimestamps?: string[];
}

// Updated interface to be compatible with ExtractedFrame
interface LocalExtractedFrame extends ExtractedFrame {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}

export const SlideEditor = () => {
  const {
    id: projectId
  } = useParams<{
    id: string;
  }>();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [editedTitle, setEditedTitle] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<Record<string, boolean>>({
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
  const [isSyncingFrames, setIsSyncingFrames] = useState<boolean>(false);
  
  // References for drag-to-scroll functionality
  const filmstripRef = useRef<HTMLDivElement>(null);
  const isMouseDown = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const scrollLeft = useRef<number>(0);
  
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
    if (!projectId) return;
    
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
  
  useEffect(() => {
    loadProject();
  }, [projectId]);
  
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
  
  // Set up drag-to-scroll functionality for the filmstrip
  useEffect(() => {
    const filmstrip = filmstripRef.current;
    if (!filmstrip) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown.current = true;
      startX.current = e.pageX - filmstrip.offsetLeft;
      scrollLeft.current = filmstrip.scrollLeft;
      filmstrip.style.cursor = 'grabbing';
      filmstrip.style.userSelect = 'none';
    };
    
    const handleMouseUp = () => {
      isMouseDown.current = false;
      filmstrip.style.cursor = 'grab';
      filmstrip.style.userSelect = '';
    };
    
    const handleMouseLeave = () => {
      isMouseDown.current = false;
      filmstrip.style.cursor = 'grab';
      filmstrip.style.userSelect = '';
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return;
      e.preventDefault();
      const x = e.pageX - filmstrip.offsetLeft;
      const walk = (x - startX.current) * 2; // Scroll speed multiplier
      filmstrip.scrollLeft = scrollLeft.current - walk;
    };
    
    // Add event listeners
    filmstrip.addEventListener('mousedown', handleMouseDown);
    filmstrip.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    
    // Initialize cursor style
    filmstrip.style.cursor = 'grab';
    
    return () => {
      // Clean up event listeners
      filmstrip.removeEventListener('mousedown', handleMouseDown);
      filmstrip.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  // NEW: Function to synchronize frames with the database
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
  
  // IMPROVED: Frame selection handler with better frame persistence
  const handleSelectFrames = async () => {
    if (!projectId || !videoPath) {
      toast.warning("No video available for frame selection");
      return;
    }
    
    try {
      // First, ensure we have the latest frames from the database
      await loadFramesFromProject();
      
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
    } catch (error) {
      console.error("Error preparing frame selection:", error);
      toast.error("Failed to prepare frame selection");
    }
  };
  
  // IMPROVED: Handle selected frames with persistence
  const handleFrameSelection = async (selectedFrames: ExtractedFrame[]) => {
    if (!selectedFrames.length) {
      toast.info("No frames were selected");
      return;
    }
    
    try {
      console.log(`Applying ${selectedFrames.length} selected frames to slide #${currentSlideIndex + 1}`, selectedFrames);
      
      // 1. Update current slide with selected frames
      const updatedSlides = [...slides];
      updatedSlides[currentSlideIndex] = {
        ...updatedSlides[currentSlideIndex],
        imageUrls: selectedFrames.map(frame => frame.imageUrl)
      };
      setSlides(updatedSlides);
      
      // 2. CRITICAL: Merge selected frames with our global frame library
      const updatedFrameLibrary = await mergeFramesWithLibrary(selectedFrames);
      
      // 3. Update both slides and frames in the database
      await Promise.all([
        updateSlidesInDatabase(updatedSlides),
        syncFramesWithDatabase(updatedFrameLibrary)
      ]);
      
      // 4. Give feedback based on selection count
      if (selectedFrames.length === 1) {
        toast.success(`Applied 1 frame to slide`);
      } else {
        toast.success(`Applied ${selectedFrames.length} frames to slide`);
      }
      
      // 5. Update project size
      fetchProjectSize();
    } catch (error) {
      console.error("Error handling frame selection:", error);
      toast.error("Failed to apply frames to slide");
    }
  };
  
  // NEW: Merge frames with the global frame library
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
  
  // IMPROVED: goToSlide function with better frame state persistence
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
      // Remove toast notification for routine slide updates
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
  
  const copyToClipboard = () => {
    if (!currentSlide) return;
    
    const slideText = `${currentSlide.title}\n\n${currentSlide.content}`;
    navigator.clipboard.writeText(slideText);
    toast.success("Slide content copied to clipboard");
  };
  
  const exportPDF = async () => {
    if (!slides || slides.length === 0) {
      toast.error("No slides to export");
      return;
    }
    
    try {
      setIsExporting((prev) => ({
        ...prev,
        pdf: true
      }));
      
      toast.loading("Generating PDF...", {
        id: "export-pdf"
      });
      
      const pdfBlob = await exportToPDF(slides, projectTitle);
      downloadFile(pdfBlob, `${projectTitle || 'presentation'}.pdf`);
      
      toast.success("PDF exported successfully!", {
        id: "export-pdf"
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF", {
        id: "export-pdf"
      });
    } finally {
      setIsExporting((prev) => ({
        ...prev,
        pdf: false
      }));
    }
  };
  
  const exportAnki = async () => {
    if (!slides || slides.length === 0) {
      toast.error("No slides to export");
      return;
    }
    
    try {
      setIsExporting((prev) => ({
        ...prev,
        anki: true
      }));
      
      toast.loading("Generating Anki deck...", {
        id: "export-anki"
      });
      
      const ankiBlob = exportToAnki(slides, projectTitle);
      downloadFile(ankiBlob, `${projectTitle || 'anki-cards'}.csv`);
      
      toast.success("Anki cards exported successfully!", {
        id: "export-anki"
      });
    } catch (error) {
      console.error("Error exporting Anki cards:", error);
      toast.error("Failed to export Anki cards", {
        id: "export-anki"
      });
    } finally {
      setIsExporting((prev) => ({
        ...prev,
        anki: false
      }));
    }
  };
  
  const exportCSV = async () => {
    if (!slides || slides.length === 0) {
      toast.error("No slides to export");
      return;
    }
    
    try {
      setIsExporting((prev) => ({
        ...prev,
        csv: true
      }));
      
      toast.loading("Generating CSV...", {
        id: "export-csv"
      });
      
      const csvBlob = exportToCSV(slides, projectTitle);
      downloadFile(csvBlob, `${projectTitle || 'slides'}.csv`);
      
      toast.success("CSV exported successfully!", {
        id: "export-csv"
      });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV", {
        id: "export-csv"
      });
    } finally {
      setIsExporting((prev) => ({
        ...prev,
        csv: false
      }));
    }
  };

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
      
      // Add the image as a frame in our frame library too
      const newFrame: LocalExtractedFrame = {
        id: `uploaded-${Date.now()}`,
        imageUrl: uploadResult.url,
        timestamp: new Date().toISOString(),
        isPlaceholder: false
      };
      
      await mergeFramesWithLibrary([newFrame]);
      
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

  // Define the deleteCurrentSlide function here
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
  
  // Modified to include the copyToClipboard, exportPDF, exportAnki, exportCSV functions and render
  return (
    <div className="h-full flex flex-col">
      {/* Navigation and toolbar */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="text-sm text-muted-foreground flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          <span>Slide {currentSlideIndex + 1} of {slides.length}</span>
          {currentSlide?.timestamp && <span className="ml-2">• Timestamp: {currentSlide.timestamp}</span>}
          <span className="ml-2">•</span>
          <FileSizeBadge projectId={projectId} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild disabled={slides.length <= 1 || slides[0].id === "slide-placeholder"}>
            <Link to={`/projects/${projectId}/present`}>
              <Presentation className="h-4 w-4 mr-1" />
              Present
            </Link>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <div className="space-y-4 p-4">
                <h3 className="text-lg font-semibold">Export Options</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button onClick={generateSlides} variant="outline" className="justify-start" disabled={isGenerating}>
                    {isGenerating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    {slides.length <= 1 ? "Generate Slides" : "Regenerate Slides"}
                  </Button>
                  
                  <Button onClick={exportPDF} variant="outline" className="justify-start" disabled={isExporting.pdf}>
                    {isExporting.pdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>}
                    PDF
                  </Button>
                  <Button onClick={exportAnki} variant="outline" className="justify-start" disabled={isExporting.anki}>
                    {isExporting.anki ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                      </svg>}
                    Anki
                  </Button>
                  <Button onClick={exportCSV} variant="outline" className="justify-start" disabled={isExporting.csv}>
                    {isExporting.csv ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="8 17 12 21 16 17"></polyline>
                        <line x1="12" y1="12" x2="12" y2="21"></line>
                        <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
                      </svg>}
                    CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main slide editing area
