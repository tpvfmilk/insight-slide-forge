
import { useState, useEffect } from "react";
import { Project, fetchProjectById } from "@/services/projectService";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { slidesNeedFrameExtraction } from "@/services/imageService";
import { hasValidSlides } from "@/services/slideGenerationService";
import { toast } from "sonner";
import { initializeStorage } from "@/services/storageService";
import { useNavigate } from "react-router-dom";
import { generateSlidesForProject } from "@/services/slideGenerationService";
import { transcribeVideo, updateProject } from "@/services/uploadService";
import { clientExtractFramesFromVideo, updateSlidesWithExtractedFrames } from "@/services/clientFrameExtractionService";

export const useProjectState = (projectId: string | undefined) => {
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState<boolean>(false);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [slidesPerMinute, setSlidesPerMinute] = useState<number>(6);
  const [title, setTitle] = useState<string>("");
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [needsFrameExtraction, setNeedsFrameExtraction] = useState<boolean>(false);
  const [allTimestamps, setAllTimestamps] = useState<string[]>([]);
  const [videoMetadata, setVideoMetadata] = useState<{
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  } | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);

  const loadProject = async () => {
    if (!projectId) return;
    
    try {
      setIsLoading(true);
      
      // Ensure storage buckets are initialized when viewing a project
      await initializeStorage();
      
      const projectData = await fetchProjectById(projectId);
      
      if (!projectData) {
        toast.error("Project not found");
        navigate("/projects");
        return;
      }
      
      setProject(projectData);
      setContextPrompt(projectData.context_prompt || "");
      // Make sure the transcript state is properly set from the project data
      setTranscript(projectData.transcript || "");
      setSlidesPerMinute(projectData.slides_per_minute || 6);
      setTitle(projectData.title || "Untitled Project");
      
      // Extract video metadata if it exists
      if (projectData.video_metadata) {
        setVideoMetadata(projectData.video_metadata as {
          duration?: number;
          original_file_name?: string;
          file_type?: string;
          file_size?: number;
        });
      }
      
      // Get previously extracted frames
      if (projectData.extracted_frames && Array.isArray(projectData.extracted_frames)) {
        setExtractedFrames(projectData.extracted_frames as ExtractedFrame[]);
      }
      
      // Check if the project has slides with timestamps but no images
      // Make sure we're passing an array to slidesNeedFrameExtraction
      const slidesArray = Array.isArray(projectData.slides) ? projectData.slides : [];
      setNeedsFrameExtraction(
        projectData.source_type === 'video' && 
        hasValidSlides(projectData) && 
        slidesNeedFrameExtraction(slidesArray)
      );
      
      // Collect all timestamps from slides for potential frame extraction
      const timestamps: string[] = [];
      if (Array.isArray(projectData.slides)) {
        projectData.slides.forEach(slide => {
          // Properly check and extract timestamps with type checking
          if (slide && typeof slide === 'object') {
            if ('timestamp' in slide && typeof slide.timestamp === 'string') {
              timestamps.push(slide.timestamp);
            }
            if ('transcriptTimestamps' in slide && Array.isArray(slide.transcriptTimestamps)) {
              // Make sure we only push string values to the timestamps array
              slide.transcriptTimestamps.forEach(timestamp => {
                if (typeof timestamp === 'string') {
                  timestamps.push(timestamp);
                }
              });
            }
          }
        });
      }
      setAllTimestamps([...new Set(timestamps)]); // Remove duplicates
      
      // Get video filename if it's a video project
      if (projectData.source_type === 'video' && projectData.source_file_path) {
        try {
          const path = projectData.source_file_path;
          const pathParts = path.split('/');
          const fileName = pathParts[pathParts.length - 1];
          setVideoFileName(fileName);
        } catch (error) {
          console.error("Error parsing video filename:", error);
        }
      }
      
      // For new projects, check if we need to transcribe or generate slides
      const isNewlyCreated = Date.now() - new Date(projectData.created_at).getTime() < 60000; // Within a minute
      
      if (isNewlyCreated) {
        // If video upload with no transcript, try to transcribe
        if (projectData.source_type === 'video' && !projectData.transcript) {
          handleTranscribeVideo();
        }
        // If has transcript but no slides, generate slides
        else if (projectData.transcript && !hasValidSlides(projectData)) {
          // For transcript-only projects, don't auto-generate slides
          if (projectData.source_type !== 'transcript-only') {
            handleGenerateSlides();
          }
        }
      }
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateSlides = async () => {
    if (!projectId || isGenerating) return;
    
    setIsGenerating(true);
    
    try {
      const result = await generateSlidesForProject(projectId);
      
      if (result.success && result.slides) {
        // Update the project in state with the new slides
        setProject(prev => {
          if (!prev) return prev;
          const updatedProject = {
            ...prev,
            slides: result.slides
          };
          
          // Check if we need frame extraction after slide generation
          if (prev.source_type === 'video') {
            setNeedsFrameExtraction(slidesNeedFrameExtraction(result.slides));
          }
          
          return updatedProject;
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranscribeVideo = async () => {
    if (!projectId || isTranscribing) return;
    
    setIsTranscribing(true);
    
    try {
      const result = await transcribeVideo(projectId);
      
      if (result.success && result.transcript) {
        // Update the project in state with the new transcript
        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            transcript: result.transcript
          };
        });
        
        setTranscript(result.transcript);
        
        // Once transcription is complete, generate slides if none exist
        if (!hasValidSlides(project)) {
          handleGenerateSlides();
        }
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleExtractFrames = async () => {
    if (!projectId || !project?.source_file_path || isExtractingFrames || allTimestamps.length === 0) {
      return;
    }
    
    setIsExtractingFrames(true);
    
    try {
      // Log important information for debugging
      console.log(`Attempting to extract frames for video with duration: ${videoMetadata?.duration || 'unknown'}`);
      console.log(`Timestamps to extract: ${allTimestamps.join(', ')}`);
      
      // First check if we already have all the frames extracted
      if (extractedFrames.length > 0) {
        const allTimestampsExtracted = allTimestamps.every(timestamp => 
          extractedFrames.some(frame => frame.timestamp === timestamp)
        );
        
        if (allTimestampsExtracted) {
          toast.success("All frames already extracted");
          setNeedsFrameExtraction(false);
          
          // Update the slides with these frames
          await updateSlidesWithExtractedFrames(projectId, extractedFrames);
          await loadProject(); // Reload the project to get updated slides
          return;
        }
      }
      
      // Get remaining timestamps to extract
      const remainingTimestamps = allTimestamps.filter(timestamp => 
        !extractedFrames.some(frame => frame.timestamp === timestamp)
      );
      
      console.log(`Attempting to extract ${remainingTimestamps.length} remaining frames`);
      
      const result = await clientExtractFramesFromVideo(
        projectId, 
        project.source_file_path, 
        remainingTimestamps,
        videoMetadata?.duration // Pass the video duration to help validate timestamps
      );
      
      if (result.success) {
        // If we retrieved previously extracted frames, use them directly
        if (result.frames && result.frames.length > 0) {
          await updateSlidesWithExtractedFrames(projectId, result.frames);
          await loadProject(); // Reload the project with updated slides
          setNeedsFrameExtraction(false);
        } else {
          return { openFrameExtractionModal: true };
        }
      } else {
        toast.error(`Failed to prepare frame extraction: ${result.error}`);
      }
    } finally {
      setIsExtractingFrames(false);
    }
    
    return { openFrameExtractionModal: false };
  };
  
  const handleFrameExtractionComplete = async (frames: Array<{ timestamp: string, imageUrl: string }>) => {
    if (!projectId) return;
    
    if (frames.length === 0) {
      toast.info("No frames were extracted");
      return;
    }
    
    // Update the project's slides with the extracted frames
    const success = await updateSlidesWithExtractedFrames(projectId, frames);
    
    if (success) {
      // Reload the project to get the updated slides with images
      await loadProject();
      setNeedsFrameExtraction(false);
      toast.success("Frame extraction completed successfully");
    }
  };
  
  const handleManualFrameSelectionComplete = async (selectedFrames: ExtractedFrame[]) => {
    if (!projectId) return;
    
    if (selectedFrames.length === 0) {
      toast.info("No frames were selected");
      return;
    }
    
    // Update the project's slides with the selected frames
    const success = await updateSlidesWithExtractedFrames(projectId, selectedFrames);
    
    if (success) {
      // Reload the project to get the updated slides with images
      await loadProject();
      setNeedsFrameExtraction(false);
      toast.success(`${selectedFrames.length} frames have been applied to your slides`);
    }
  };

  // Load project on mount or when projectId changes
  useEffect(() => {
    loadProject();
  }, [projectId]);

  // Calculate additional states
  const needsTranscription = project?.source_type === 'video' && !project?.transcript;
  const isTranscriptOnlyProject = project?.source_type === 'transcript-only';

  return {
    project,
    setProject,
    isLoading,
    isGenerating,
    isTranscribing,
    isExtractingFrames,
    contextPrompt,
    setContextPrompt,
    transcript,
    setTranscript,
    slidesPerMinute,
    setSlidesPerMinute,
    title,
    setTitle,
    videoFileName,
    needsFrameExtraction,
    allTimestamps,
    videoMetadata,
    extractedFrames,
    needsTranscription,
    isTranscriptOnlyProject,
    
    // Actions
    loadProject,
    handleGenerateSlides,
    handleTranscribeVideo,
    handleExtractFrames,
    handleFrameExtractionComplete,
    handleManualFrameSelectionComplete,
  };
};
