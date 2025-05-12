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
import { updateSlidesWithExtractedFrames } from "@/services/clientFrameExtractionService";
import { fetchProjectVideos, ProjectVideo } from "@/services/projectVideoService";
import { supabase } from "@/integrations/supabase/client";

export const useProjectState = (projectId: string | undefined) => {
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState<boolean>(false);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
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
  const [projectVideos, setProjectVideos] = useState<ProjectVideo[]>([]);
  const [totalVideoDuration, setTotalVideoDuration] = useState<number>(0);

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
      setTranscript(projectData.transcript || "");
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
      
      // Get previously extracted frames - ensure they're properly loaded
      if (projectData.extracted_frames && Array.isArray(projectData.extracted_frames)) {
        const frames = projectData.extracted_frames as ExtractedFrame[];
        console.log(`Loaded ${frames.length} extracted frames from project`);
        
        // Validate frames have proper URLs before setting state
        const validFrames = frames.filter(frame => 
          frame && frame.imageUrl && !frame.imageUrl.startsWith('blob:')
        );
        
        if (validFrames.length !== frames.length) {
          console.warn(`Filtered out ${frames.length - validFrames.length} frames with invalid URLs`);
        }
        
        setExtractedFrames(validFrames);
      } else {
        setExtractedFrames([]);
      }
      
      // Load all project videos
      const videos = await fetchProjectVideos(projectId);
      setProjectVideos(videos);
      console.log(`Loaded ${videos.length} videos for project`);
      
      // Calculate total video duration
      if (videos.length > 0) {
        const totalDuration = videos.reduce((total, video) => {
          const duration = video.video_metadata?.duration || 0;
          return total + duration;
        }, 0);
        setTotalVideoDuration(totalDuration);
        console.log(`Total duration of all videos: ${totalDuration}s`);
      }
      
      // Check if frames are needed for UI indication
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
          
          // We will still check if frames are needed, but not automatically extract them
          if (prev.source_type === 'video') {
            setNeedsFrameExtraction(slidesNeedFrameExtraction(result.slides));
            
            // Inform the user that they need to manually select frames
            if (slidesNeedFrameExtraction(result.slides)) {
              toast.info("Slides have been generated. You can now manually select frames for your slides.");
            }
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
      console.log(`Transcribing videos for project ${projectId}`, projectVideos);
      // Now we pass all videos in the project to be transcribed
      const result = await transcribeVideo(projectId, projectVideos);
      
      if (result.success && result.transcript) {
        console.log("Transcription succeeded, updating project with transcript");
        
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
      } else {
        console.error("Transcription failed or returned empty transcript");
      }
    } catch (error) {
      console.error("Error in handleTranscribeVideo:", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Modified to be a no-op as we don't want automatic extraction
  const handleExtractFrames = async () => {
    // This is now intentionally empty - we only want manual frame selection
    return;
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
  
  // Updated to ensure frames are properly saved and processed
  const handleManualFrameSelectionComplete = async (selectedFrames: ExtractedFrame[]): Promise<boolean> => {
    if (!projectId) return false;
    
    if (!selectedFrames || selectedFrames.length === 0) {
      toast.info("No frames were selected");
      return false;
    }
    
    try {
      console.log(`Processing ${selectedFrames.length} selected frames for project ${projectId}`);
      
      // First, verify all frames have valid permanent URLs (not blob:// URLs)
      const invalidFrames = selectedFrames.filter(frame => 
        !frame.imageUrl || 
        frame.imageUrl.startsWith('blob:') || 
        !frame.timestamp
      );
      
      if (invalidFrames.length > 0) {
        console.error("Cannot update slides with invalid URLs:", invalidFrames);
        toast.error("Cannot save frames with temporary URLs. Please try capturing frames again.");
        return false;
      }
      
      // Get current project data with extracted frames
      const { data: projectData, error: getError } = await supabase
        .from('projects')
        .select('extracted_frames')
        .eq('id', projectId)
        .single();
        
      if (getError) {
        console.error("Error getting project data:", getError);
        toast.error("Failed to update project with selected frames");
        return false;
      }
      
      // Get existing frames or initialize empty array
      const existingFrames: ExtractedFrame[] = (projectData?.extracted_frames as unknown as ExtractedFrame[]) || [];
      console.log(`Found ${existingFrames.length} existing frames in project`);
      
      // Filter out frames that are white/blank
      const nonBlankFrames = selectedFrames.filter(frame => !frame.isPlaceholder);
      
      if (nonBlankFrames.length === 0) {
        toast.error("All selected frames appear to be blank. Please try capturing frames at different timestamps.");
        return false;
      }
      
      // Merge with new frames, removing duplicates by timestamp
      // If a frame with the same timestamp exists, the new one replaces it
      const framesByTimestamp = new Map<string, ExtractedFrame>();
      
      // First add all existing frames
      existingFrames.forEach(frame => {
        if (frame.timestamp) {
          framesByTimestamp.set(frame.timestamp, frame);
        }
      });
      
      // Then add/override with new frames
      nonBlankFrames.forEach(frame => {
        if (frame.timestamp) {
          framesByTimestamp.set(frame.timestamp, frame);
        }
      });
      
      // Convert map back to array
      const combinedFrames = Array.from(framesByTimestamp.values());
      
      console.log(`Updating project with ${nonBlankFrames.length} new frames, total will be ${combinedFrames.length} frames`);
      
      // Update project with combined frames
      const { error: updateError } = await supabase
        .from('projects')
        .update({ extracted_frames: combinedFrames })
        .eq('id', projectId);
        
      if (updateError) {
        console.error("Error updating project frames:", updateError);
        toast.error("Failed to store selected frames");
        return false;
      }
      
      // Now update the slides to show the selected frames
      const success = await updateSlidesWithExtractedFrames(projectId, combinedFrames);
      
      if (!success) {
        console.error("Failed to update slides with frames");
        toast.error("Failed to update slides with selected frames");
        return false;
      }
      
      // Update local state with the new frames
      setExtractedFrames(combinedFrames);
      
      console.log(`Successfully saved ${nonBlankFrames.length} frames to project`);
      return true;
    } catch (error) {
      console.error("Error in handleManualFrameSelectionComplete:", error);
      toast.error("An error occurred while processing the selected frames");
      return false;
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
    title,
    setTitle,
    videoFileName,
    needsFrameExtraction,
    allTimestamps,
    videoMetadata,
    extractedFrames,
    needsTranscription,
    isTranscriptOnlyProject,
    projectVideos,
    totalVideoDuration,
    
    // Actions
    loadProject,
    handleGenerateSlides,
    handleTranscribeVideo,
    handleExtractFrames,
    handleFrameExtractionComplete,
    handleManualFrameSelectionComplete,
  };
};
