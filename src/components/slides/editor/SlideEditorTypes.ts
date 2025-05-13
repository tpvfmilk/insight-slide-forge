
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
