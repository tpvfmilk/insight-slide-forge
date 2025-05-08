import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Download, Clock, Image as ImageIcon, RefreshCw, Presentation, Upload, Trash2, FrameIcon, Plus, X, Undo } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjectById } from "@/services/projectService";
import { uploadSlideImage } from "@/services/imageService";
import { exportToPDF, exportToCSV, exportToAnki, downloadFile } from "@/services/exportService";
import { clientExtractFramesFromVideo, updateSlidesWithExtractedFrames, ExtractedFrame } from "@/services/clientFrameExtractionService";
import { FrameExtractionModal } from "@/components/video/FrameExtractionModal";
import { FrameSelector } from "@/components/slides/FrameSelector";
import { cleanupFrameSelectorDialog } from "@/utils/uiUtils";
import { getProjectTotalSize } from "@/services/storageService";
import { FileSizeBadge } from "@/components/projects/FileSizeBadge";

interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
  imageUrls?: string[];
  transcriptTimestamps?: string[];
}

// For local components we need a compatible interface
interface LocalExtractedFrame {
  imageUrl: string;
  timestamp: string;
  id: string;
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
  const [isExtractingFrames, setIsExtractingFrames] = useState<boolean>(false);
  const [isFrameExtractionModalOpen, setIsFrameExtractionModalOpen] = useState<boolean>(false);
  const [isFrameSelectorOpen, setIsFrameSelectorOpen] = useState<boolean>(false);
  const [allExtractedFrames, setAllExtractedFrames] = useState<LocalExtractedFrame[]>([]);
  const [videoPath, setVideoPath] = useState<string>("");
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [lastDeletedSlide, setLastDeletedSlide] = useState<Slide | null>(null);
  const [showUndoButton, setShowUndoButton] = useState<boolean>(false);
  const [projectSize, setProjectSize] = useState<number>(0);
  
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

      // Load all extracted frames
      if (project.extracted_frames && Array.isArray(project.extracted_frames)) {
        // Transform the API ExtractedFrame format to our local format
        const frames = (project.extracted_frames as unknown as ExtractedFrame[]).map(frame => ({
          imageUrl: frame.imageUrl,
          timestamp: frame.timestamp,
          id: `frame-${frame.timestamp.replace(/:/g, "-")}` // Generate a unique ID
        }));
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
  
  const generateSlides = async () => {
    if (!projectId) return;
    try {
      setIsGenerating(true);
      toast.loading("Generating slides...", {
        id: "generate-slides"
      });
      const response = await fetch(`https://bjzvlatqgrqaefnwihjj.supabase.co/functions/v1/generate-slides`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          projectId
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate slides");
      }
      const {
        slides: generatedSlides
      } = await response.json();
      if (!generatedSlides || !Array.isArray(generatedSlides) || generatedSlides.length === 0) {
        throw new Error("No slides were generated");
      }

      // Type assertion to ensure we're setting the proper Slide[] type
      setSlides(generatedSlides as Slide[]);
      setCurrentSlideIndex(0);

      // Update edited fields with the first slide
      if (generatedSlides[0]) {
        setEditedTitle(generatedSlides[0].title);
        setEditedContent(generatedSlides[0].content);
      }
      toast.success("Slides generated successfully!", {
        id: "generate-slides"
      });
      
      // Update project size after generation
      fetchProjectSize();
    } catch (error) {
      console.error("Error generating slides:", error);
      toast.error(`Failed to generate slides: ${error.message}`, {
        id: "generate-slides"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleExtractFrames = async () => {
    if (!projectId || !videoPath || isExtractingFrames || timestamps.length === 0) {
      if (!videoPath) {
        toast.error("No video available for this project");
      } else if (timestamps.length === 0) {
        toast.error("No timestamps found in slides");
      }
      return;
    }
    setIsExtractingFrames(true);
    toast.loading("Preparing video frames extraction...", {
      id: "extract-prep"
    });
    try {
      let result;

      // Try with the current path first
      result = await clientExtractFramesFromVideo(projectId, videoPath, timestamps);
      if (!result.success && result.error?.includes("Failed to get video URL")) {
        // If that fails, try getting the source_url from the project and see if we can use that
        console.log("Original video path failed, checking project for alternate sources");
        const {
          data: project
        } = await supabase.from('projects').select('source_url').eq('id', projectId).maybeSingle();
        if (project?.source_url) {
          toast.info("Trying alternate video source...", {
            id: "extract-prep"
          });
          result = await clientExtractFramesFromVideo(projectId, project.source_url, timestamps);
        }
      }
      toast.dismiss("extract-prep");
      if (result.success) {
        setIsFrameExtractionModalOpen(true);
      } else {
        toast.error(`Failed to prepare frame extraction: ${result.error}`);
      }
    } finally {
      setIsExtractingFrames(false);
    }
  };
  
  const handleFrameExtractionComplete = async (frames: Array<{
    timestamp: string;
    imageUrl: string;
  }>) => {
    if (!projectId) return;
    setIsFrameExtractionModalOpen(false);
    if (frames.length === 0) {
      toast.info("No frames were extracted");
      return;
    }

    // Update the project's slides with the extracted frames
    const success = await updateSlidesWithExtractedFrames(projectId, frames);
    if (success) {
      // Reload the project to get the updated slides with images
      await loadProject();
      toast.success("Frame extraction completed successfully");
      
      // Update project size
      fetchProjectSize();
    }
  };
  
  const handleSelectFrames = () => {
    if (allExtractedFrames.length === 0) {
      toast.warning("No frames available. Extract frames or use the manual frame picker first.");
      return;
    }
    setIsFrameSelectorOpen(true);
  };
  
  const handleFrameSelection = (selectedFrames: LocalExtractedFrame[]) => {
    if (!selectedFrames.length) return;

    // Update current slide with selected frames
    const updatedSlides = [...slides];
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      imageUrls: selectedFrames.map(frame => frame.imageUrl)
    };
    setSlides(updatedSlides);

    // Also update in the database
    updateSlidesInDatabase(updatedSlides);
    // Reduced toast notification
    if (selectedFrames.length > 1) {
      toast.success(`${selectedFrames.length} frames applied to slide`);
    }
    
    // Update project size
    fetchProjectSize();
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
      toast.success("Slide updated");
    }
  };
  
  const updateSlidesInDatabase = async (updatedSlides: Slide[]) => {
    if (!projectId) return;
    try {
      // Ensure we're passing the slides in a format compatible with Json type
      const {
        error
      } = await supabase.from('projects').update({
        slides: updatedSlides as any
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
      setIsExporting(prev => ({
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
      setIsExporting(prev => ({
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
      setIsExporting(prev => ({
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
      setIsExporting(prev => ({
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
      setIsExporting(prev => ({
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
      setIsExporting(prev => ({
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
  
  const handleDeleteFrame = (frameIndex: number) => {
    if (!currentSlide.imageUrls || currentSlide.imageUrls.length === 0) {
      return;
    }

    // Create a copy of the slide's imageUrls array without the deleted frame
    const updatedImageUrls = [...currentSlide.imageUrls];
    updatedImageUrls.splice(frameIndex, 1);

    // Update the current slide with the new imageUrls array
    const updatedSlides = [...slides];
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      imageUrls: updatedImageUrls.length > 0 ? updatedImageUrls : undefined
    };
    setSlides(updatedSlides);

    // Also update in the database
    updateSlidesInDatabase(updatedSlides);
    // Removed toast notification for routine operation
    
    // Update project size
    fetchProjectSize();
  };
  
  // Add new slide function
  const addNewSlide = () => {
    // Create a new slide with default content
    const newSlide = {
      id: `slide-${Date.now()}`,
      title: "New Slide",
      content: "Add your content here"
    };
    
    // Insert it after the current slide
    const newSlides = [...slides];
    newSlides.splice(currentSlideIndex + 1, 0, newSlide);
    
    // Update the state
    setSlides(newSlides);
    
    // Save to database
    updateSlidesInDatabase(newSlides);
    
    // Navigate to the new slide
    saveChanges();
    setCurrentSlideIndex(currentSlideIndex + 1);
    
    toast.success("New slide added");
  };
  
  // Delete current slide with undo functionality
  const deleteCurrentSlide = () => {
    // Don't allow deleting the last slide
    if (slides.length <= 1) {
      toast.error("Cannot delete the last slide");
      return;
    }
    
    // Save the slide before deleting it
    setLastDeletedSlide(slides[currentSlideIndex]);
    setShowUndoButton(true);
    
    // Create updated slides array without the current slide
    const newSlides = [...slides];
    newSlides.splice(currentSlideIndex, 1);
    
    // Update the state
    setSlides(newSlides);
    
    // Save to database
    updateSlidesInDatabase(newSlides);
    
    // Navigate to previous slide or stay at current index if it was the first slide
    const newIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : 0;
    setCurrentSlideIndex(newIndex);
    
    toast.success("Slide deleted");
  };
  
  // Undo delete slide
  const undoDeleteSlide = () => {
    if (!lastDeletedSlide) return;
    
    // Insert the deleted slide back at its original position or at the end
    const insertIndex = Math.min(currentSlideIndex + 1, slides.length);
    const newSlides = [...slides];
    newSlides.splice(insertIndex, 0, lastDeletedSlide);
    
    // Update the state
    setSlides(newSlides);
    updateSlidesInDatabase(newSlides);
    
    // Navigate to the restored slide
    setCurrentSlideIndex(insertIndex);
    
    // Reset undo state
    setLastDeletedSlide(null);
    setShowUndoButton(false);
    
    toast.success("Slide restored");
  };
  
  if (isLoading) {
    return <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading slides...</p>
        </div>
      </div>;
  }
  
  return <div className="flex flex-col h-full">
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
      
      {/* Changed from grid to flex for better responsiveness */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left pane - Image */}
        <div className="flex-1 min-w-0 flex flex-col border-b md:border-b-0 md:border-r">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-medium">Slide Visual</h3>
            {/* Separate buttons for frame tools */}
            <div className="flex gap-2">
              {videoPath && timestamps.length > 0 && <Button variant="outline" size="sm" onClick={handleExtractFrames} disabled={isExtractingFrames}>
                  {isExtractingFrames ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <FrameIcon className="h-4 w-4 mr-1" />}
                  Extract Frames
                </Button>}
              
              {allExtractedFrames.length > 0 && <Button variant="outline" size="sm" onClick={handleSelectFrames}>
                  <ImageIcon className="h-4 w-4 mr-1" />
                  Select Frames
                </Button>}
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            {currentSlide?.imageUrls && currentSlide.imageUrls.length > 0 ? <div className="w-full h-full">
                {/* Responsive grid that stacks vertically when space is limited */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  {/* First, render all existing images with delete buttons */}
                  {currentSlide.imageUrls.map((url, index) => <div key={`slide-image-${index}`} className="relative group aspect-video">
                      <img src={url} alt={`Slide visual ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                      {/* Individual frame delete button - always visible */}
                      <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => handleDeleteFrame(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>)}
                  
                  {/* Add the "Add Image" button as the last item */}
                  <label htmlFor="image-upload-grid" className="relative aspect-video flex items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Plus className="h-8 w-8 mb-2" />
                      <span>Upload Image</span>
                    </div>
                    <input id="image-upload-grid" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                  </label>
                </div>
              </div> : currentSlide?.imageUrl ? <div className="relative w-full h-full group">
                <img src={currentSlide.imageUrl} alt="Slide visual" className="w-full h-full object-contain" />
                {/* Delete button for single imageUrl */}
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => handleDeleteFrame(0)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                
                {/* Add upload button next to the single image */}
                <label htmlFor="image-upload-single" className="absolute bottom-2 right-2">
                  <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add More
                  </Button>
                  <input id="image-upload-single" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                </label>
              </div> : <div className="flex flex-col items-center justify-center text-muted-foreground h-full">
                <ImageIcon className="h-10 w-10 mb-2" />
                <p>No image available</p>
                <div className="flex flex-col gap-2 mt-4">
                  {/* Buttons for when no images exist */}
                  <div className="flex gap-2">
                    {videoPath && timestamps.length > 0 && <Button variant="outline" size="sm" onClick={handleExtractFrames} disabled={isExtractingFrames}>
                        <FrameIcon className="h-4 w-4 mr-1" />
                        Extract Frames
                      </Button>}
                    
                    {allExtractedFrames.length > 0 && <Button variant="outline" size="sm" onClick={handleSelectFrames}>
                        <ImageIcon className="h-4 w-4 mr-1" />
                        Select Frames
                      </Button>}
                  </div>
                  
                  <label htmlFor="image-upload-empty" className="w-full">
                    <Button variant="outline" size="sm" className="cursor-pointer w-full">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Image
                    </Button>
                    <input id="image-upload-empty" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>}
          </div>
        </div>
        
        {/* Right pane - Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-medium">Slide Content</h3>
            {isEditing ? <Button size="sm" onClick={saveChanges}>Save Changes</Button> : <Button size="sm" variant="ghost" onClick={startEditing}>Edit</Button>}
          </div>
          <div className="flex-1 p-4 overflow-auto">
            {isEditing ? <div className="space-y-4 h-full">
                <div className="space-y-2">
                  <label htmlFor="slide-title" className="text-sm font-medium">Title</label>
                  <Textarea id="slide-title" value={editedTitle} onChange={e => setEditedTitle(e.target.value)} className="resize-none" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="slide-content" className="text-sm font-medium">Content</label>
                  <Textarea id="slide-content" value={editedContent} onChange={e => setEditedContent(e.target.value)} className="resize-none flex-1 min-h-[200px]" />
                </div>
              </div> : <div className="space-y-4">
                <h2 className="text-xl font-semibold">{currentSlide?.title}</h2>
                <div className="whitespace-pre-line">{currentSlide?.content}</div>
              </div>}
          </div>
        </div>
      </div>
      
      <Separator />
      
      {/* Bottom navigation with added new slide and delete slide buttons */}
      <div className="flex justify-between items-center p-4">
        <Button variant="outline" onClick={goToPrevSlide} disabled={currentSlideIndex === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        
        <div className="flex gap-1 items-center">
          {slides.map((_, index) => <Button key={index} variant={index === currentSlideIndex ? "default" : "ghost"} size="icon" className="w-8 h-8 rounded-full" onClick={() => {
            saveChanges();
            setCurrentSlideIndex(index);
          }}>
              {index + 1}
            </Button>)}
            
          {/* Add new slide button */}
          <Button 
            variant="outline" 
            size="icon" 
            className="w-8 h-8 rounded-full ml-1" 
            onClick={addNewSlide}
            title="Add new slide"
          >
            <Plus className="h-4 w-4" />
          </Button>
          
          {/* Delete current slide button with undo button */}
          <div className="relative">
            <Button 
              variant="destructive" 
              size="icon" 
              className="w-8 h-8 rounded-full ml-1" 
              onClick={deleteCurrentSlide}
              title="Delete current slide"
              disabled={slides.length <= 1}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Undo button that appears after deletion */}
            {showUndoButton && (
              <Button 
                variant="secondary"
                size="sm"
                className="absolute -top-10 -right-2 whitespace-nowrap shadow-md"
                onClick={undoDeleteSlide}
              >
                <Undo className="h-4 w-4 mr-1" />
                Undo Delete
              </Button>
            )}
          </div>
        </div>
        
        <Button variant="outline" onClick={goToNextSlide} disabled={currentSlideIndex === slides.length - 1}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Frame Selection Modal with fixed height/overflow */}
      <FrameSelector open={isFrameSelectorOpen} onClose={() => {
      setIsFrameSelectorOpen(false);
      // Ensure proper cleanup
      cleanupFrameSelectorDialog();
    }} availableFrames={allExtractedFrames} selectedFrames={currentSlide?.imageUrls?.map(url => {
      // Find frame with matching URL
      const frame = allExtractedFrames.find(f => f.imageUrl === url);
      return frame || {
        imageUrl: url,
        timestamp: "unknown",
        id: `unknown-${url}`
      };
    }) || []} onSelect={handleFrameSelection} />
      
      {/* Frame Extraction Modal */}
      {videoPath && <FrameExtractionModal open={isFrameExtractionModalOpen} onClose={() => setIsFrameExtractionModalOpen(false)} videoPath={videoPath} projectId={projectId || ""} timestamps={timestamps} onComplete={handleFrameExtractionComplete} />}
    </div>;
};
