import { useState, useEffect, useCallback } from "react";
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
import { handleManualFrameSelectionComplete, Slide as FrameUtilsSlide } from "@/utils/frameUtils";

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
  
  // Updated to handle selected frames properly
  const handleFrameSelection = (selectedFrames: ExtractedFrame[]) => {
    if (!selectedFrames.length) {
      toast.info("No frames were selected");
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
    
    // Give feedback based on selection count
    if (selectedFrames.length === 1) {
      toast.success(`Applied 1 frame to slide`);
    } else {
      toast.success(`Applied ${selectedFrames.length} frames to slide`);
    }
    
    // Update project size
    fetchProjectSize();
  };
  
  // Modified goToSlide function to handle transitions between slides
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
    toast.success("Image removed from slide");
  };
  
  const deleteCurrentSlide = () => {
    if (slides.length <= 1) {
      toast.error("Cannot delete the only slide");
      return;
    }
    
    const deletedSlide = slides[currentSlideIndex];
    const updatedSlides = slides.filter((_, index) => index !== currentSlideIndex);
    setSlides(updatedSlides);
    
    // Set current slide index to previous slide, or first slide if we deleted the first one
    const newIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : 0;
    setCurrentSlideIndex(newIndex);
    
    // Save the deleted slide in case we need to undo
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
  
  // Render the component with the same structure but the updated frame selection functionality
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

      {/* Main slide editing area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slides sidebar */}
        <div className="w-60 border-r h-full overflow-y-auto bg-muted/20">
          <div className="p-3 border-b flex justify-between items-center">
            <h3 className="font-semibold text-sm">Slides ({slides.length})</h3>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={addNewSlide}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2 p-2">
            {slides.map((slide, index) => (
              <div 
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  currentSlideIndex === index ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <p className="font-medium text-sm truncate">{slide.title}</p>
                <p className="text-xs truncate opacity-80">
                  {slide.content.substring(0, 30)}{slide.content.length > 30 ? "..." : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Current slide content */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1 p-4">
            {/* Title */}
            <div className="mb-4">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full text-xl font-semibold border-b border-primary/20 focus:border-primary outline-none pb-1 bg-transparent"
                />
              ) : (
                <h2 
                  className="text-xl font-semibold pb-1 border-b border-transparent cursor-pointer hover:border-muted-foreground" 
                  onClick={startEditing}
                >
                  {currentSlide?.title}
                </h2>
              )}
            </div>

            {/* Content */}
            <div className="mb-4 min-h-[200px]">
              {isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[200px] resize-none"
                />
              ) : (
                <div 
                  className="prose max-w-none cursor-pointer"
                  onClick={startEditing}
                >
                  {currentSlide?.content.split("\n").map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
            
            {/* Images section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Images</h3>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSelectFrames}
                  >
                    <Film className="h-3.5 w-3.5 mr-1" />
                    Select Frames
                  </Button>
                  <label>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={isUploadingImage}
                    >
                      <span>
                        {isUploadingImage ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
              
              {/* Image gallery */}
              {currentSlide && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {/* Show from imageUrl (legacy) */}
                  {currentSlide.imageUrl && (
                    <div className="relative group aspect-video rounded-md overflow-hidden border">
                      <img 
                        src={currentSlide.imageUrl} 
                        alt="Slide image"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="destructive"
                          size="sm"
                          className="h-7"
                          onClick={() => removeImage(currentSlide.imageUrl!)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Show from imageUrls (new approach) */}
                  {currentSlide.imageUrls && currentSlide.imageUrls.map((url, i) => (
                    <div key={i} className="relative group aspect-video rounded-md overflow-hidden border">
                      <img 
                        src={url} 
                        alt={`Slide image ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="destructive"
                          size="sm"
                          className="h-7"
                          onClick={() => removeImage(url)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Empty state */}
                  {(!currentSlide.imageUrl && (!currentSlide.imageUrls || currentSlide.imageUrls.length === 0)) && (
                    <div className="col-span-full flex items-center justify-center h-32 border rounded-md bg-muted/20">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6 mx-auto mb-2" />
                        <p className="text-sm">No images for this slide</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Slide actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div>
                {isEditing && (
                  <Button onClick={saveChanges}>Save Changes</Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                >
                  Copy Content
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteCurrentSlide}
                  disabled={slides.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Slide
                </Button>
              </div>
            </div>
          </div>
          
          {/* Slide navigation */}
          <div className="border-t p-2 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextSlide}
              disabled={currentSlideIndex === slides.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Frame Picker Modal */}
      {isFramePickerModalOpen && (
        <FramePickerModal
          open={isFramePickerModalOpen}
          onClose={() => setIsFramePickerModalOpen(false)} 
          videoPath={videoPath}
          projectId={projectId}
          onSelectFrames={handleFrameSelection}
          allExtractedFrames={allExtractedFrames}
          // Convert string URLs to ExtractedFrame objects for compatibility
          existingFrames={currentSlide?.imageUrls?.map(url => {
            // Try to find the matching extracted frame by URL
            const matchingFrame = allExtractedFrames.find(frame => frame.imageUrl === url);
            if (matchingFrame) {
              return matchingFrame;
            }
            // Create a placeholder frame object if no match is found
            return {
              imageUrl: url,
              timestamp: "unknown",
              id: `url-${url.split('/').pop()}`,
              isPlaceholder: true
            };
          }) || []}
        />
      )}
    </div>
  );
};
