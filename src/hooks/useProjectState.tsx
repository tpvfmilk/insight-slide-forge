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
      // Make sure the transcript state is properly set from the project data
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
      
      // Get previously extracted frames
      if (projectData.extracted_frames && Array.isArray(projectData.extracted_frames)) {
        setExtractedFrames(projectData.extracted_frames as ExtractedFrame[]);
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
      
      // We will still check if frames are needed, but we won't automatically extract them
      // This is just for UI indication purposes
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
      
      // For new projects, check if we need to transcribe
      const isNewlyCreated = Date.now() - new Date(projectData.created_at).getTime() < 60000; // Within a minute
      
      if (isNewlyCreated) {
        // If video upload with no transcript, try to transcribe
        if (projectData.source_type === 'video' && !projectData.transcript) {
          handleTranscribeVideo();
        }
        // NO LONGER automatically generate slides or extract frames
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
