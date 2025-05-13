
// Define shared types for the slide editor components
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

// Define a slide interface
export interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
  imageUrls?: string[];
  transcriptTimestamps?: string[];
}

// Extended interface for extracted frames
export interface LocalExtractedFrame extends ExtractedFrame {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
}

// Props for the main SlideEditor component
export interface SlideEditorProps {
  projectId?: string;
}

// Export types for the different export formats
export type ExportFormat = 'pdf' | 'anki' | 'csv';

export interface ExportState {
  pdf: boolean;
  anki: boolean;
  csv: boolean;
}

// Define the slide editor context value interface
export interface SlideEditorContextValue {
  // State
  slides: Slide[];
  currentSlideIndex: number;
  currentSlide: Slide | null;
  editedTitle: string;
  editedContent: string;
  isEditing: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  projectTitle: string;
  isUploadingImage: boolean;
  isExporting: ExportState;
  isFrameSelectorOpen: boolean;
  allExtractedFrames: LocalExtractedFrame[];
  videoPath: string;
  timestamps: string[];
  lastDeletedSlide: Slide | null;
  showUndoButton: boolean;
  projectSize: number;
  isFramePickerModalOpen: boolean;
  videoMetadata: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  } | null;
  projectId: string;
  
  // Methods
  setSlides: React.Dispatch<React.SetStateAction<Slide[]>>;
  setCurrentSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  setEditedTitle: React.Dispatch<React.SetStateAction<string>>;
  setEditedContent: React.Dispatch<React.SetStateAction<string>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFramePickerModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  goToSlide: (index: number) => void;
  goToNextSlide: () => void;
  goToPrevSlide: () => void;
  saveChanges: () => void;
  startEditing: () => void;
  copyToClipboard: () => void;
  generateSlides: () => Promise<void>;
  handleSelectFrames: () => void;
  handleFrameSelection: (selectedFrames: LocalExtractedFrame[]) => void;
  handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeImage: (imageUrl: string) => void;
  deleteSlideFromFilmstrip: (event: React.MouseEvent<Element, MouseEvent>, slideIndex: number) => void;
  deleteCurrentSlide: () => void;
  addNewSlide: () => void;
  undoDeleteSlide: () => void;
  updateSlidesInDatabase: (updatedSlides: Slide[]) => Promise<void>;
  fetchProjectSize: () => Promise<void>;
}
