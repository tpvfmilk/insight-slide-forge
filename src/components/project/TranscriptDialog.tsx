import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Check, Undo, ArrowDown, AlertTriangle } from "lucide-react";
import { Project } from "@/services/projectService";
import { toast } from "sonner";
import { cleanupTranscript, formatWithSpeakers, splitIntoParagraphs, addTimestamps, hasMultipleVideoSections } from "@/utils/transcriptUtils";
import { TranscriptRenderer } from "@/components/transcript/TranscriptRenderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fetchProjectVideos } from "@/services/projectVideoService";
import { transcribeVideo, updateProject } from "@/services/uploadService";
import { ExtendedVideoMetadata } from "@/types/videoChunking";

interface TranscriptDialogProps {
  project: Project | null;
  transcript: string;
  setTranscript: (transcript: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const TranscriptDialog = ({ 
  project, 
  transcript, 
  setTranscript,
  isOpen,
  onOpenChange
}: TranscriptDialogProps) => {
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isReTranscribing, setIsReTranscribing] = useState<boolean>(false);
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  const [originalTranscript, setOriginalTranscript] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<boolean>(true);
  const [showTimestamps, setShowTimestamps] = useState<boolean>(true);
  const [highlightSpeakers, setHighlightSpeakers] = useState<boolean>(true);
  const [hasMultipleSections, setHasMultipleSections] = useState<boolean>(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);
  const [combinedTranscript, setCombinedTranscript] = useState<string>("");
  const [debugMode, setDebugMode] = useState<boolean>(false);

  // For standalone use
  const open = isOpen !== undefined ? isOpen : isTranscriptDialogOpen;
  const setOpen = onOpenChange || setIsTranscriptDialogOpen;
  
  // Fetch and combine all transcripts from project videos
  const loadAllProjectTranscripts = async () => {
    if (!project?.id) return;
    
    setIsLoadingTranscript(true);
    
    try {
      // First, get the main project transcript as the base
      let fullTranscript = project.transcript || "";
      
      // If this is a multi-video project, we need to fetch all video transcripts
      const projectVideos = await fetchProjectVideos(project.id);
      
      if (projectVideos && projectVideos.length > 0) {
        console.log(`Found ${projectVideos.length} additional videos in the project`);
        
        // Check if main transcript already has section headers (## format)
        const alreadyHasSections = hasMultipleVideoSections(fullTranscript);
        
        // If we have additional videos and the main transcript doesn't already use section headers,
        // we should add a header for the main video
        if (projectVideos.length > 0 && !alreadyHasSections && fullTranscript.trim()) {
          const mainVideoTitle = project.title || "Main Video";
          fullTranscript = `## ${mainVideoTitle}\n\n${fullTranscript}`;
        }
        
        // Add each additional video's transcript
        for (const video of projectVideos) {
          if (video.transcript && video.transcript.trim()) {
            const videoTitle = video.title || `Video ${video.display_order || ""}`;
            
            // Add a separator and header before each additional video's transcript
            fullTranscript += `\n\n## ${videoTitle}\n\n${video.transcript}`;
          }
        }
        
        // Set flag to show if we have multiple video sections
        setHasMultipleSections(true);
      }
      
      setCombinedTranscript(fullTranscript);
      setEditedTranscript(fullTranscript);
      setOriginalTranscript(fullTranscript);
      
    } catch (error) {
      console.error("Error loading project transcripts:", error);
      toast.error("Failed to load all project transcripts");
    } finally {
      setIsLoadingTranscript(false);
    }
  };
  
  // Initialize edited transcript when dialog opens or when in tabbed mode
  useEffect(() => {
    if (open || isOpen) {
      loadAllProjectTranscripts();
    }
  }, [open, project, isOpen]);
  
  const handleSaveTranscript = async () => {
    if (!project?.id) return;
    
    setIsSaving(true);
    
    try {
      // Save the combined transcript to the main project
      await updateProject(project.id, {
        transcript: editedTranscript
      });
      
      // Update the parent state
      setTranscript(editedTranscript);
      
      toast.success("Transcript saved");
      if (setOpen) setOpen(false);
    } catch (error) {
      console.error("Error saving transcript:", error);
      toast.error("Failed to save transcript");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleFormatTranscript = (formatType: 'cleanup' | 'speakers' | 'paragraphs' | 'timestamps' | 'reset') => {
    if (formatType === 'reset') {
      setEditedTranscript(originalTranscript);
      return;
    }
    
    let formattedText = editedTranscript;
    
    switch (formatType) {
      case 'cleanup':
        formattedText = cleanupTranscript(formattedText);
        break;
      case 'speakers':
        formattedText = formatWithSpeakers(formattedText);
        break;
      case 'paragraphs':
        formattedText = splitIntoParagraphs(formattedText);
        break;
      case 'timestamps':
        formattedText = addTimestamps(formattedText);
        break;
      default:
        break;
    }
    
    setEditedTranscript(formattedText);
  };
  
  const formatAllAtOnce = () => {
    let formattedText = editedTranscript;
    formattedText = cleanupTranscript(formattedText);
    formattedText = formatWithSpeakers(formattedText);
    formattedText = splitIntoParagraphs(formattedText);
    setEditedTranscript(formattedText);
    toast.success("Transcript formatted");
  };

  // Enhanced re-transcription with improved error handling
  const handleReTranscribe = async () => {
    if (!project?.id) return;
    
    try {
      setIsReTranscribing(true);
      const toastId = "retranscribe";
      toast.loading("Re-transcribing video...", { id: toastId });
      
      // Debug logging - enhanced to track chunking process
      if (debugMode) {
        console.log(`[DEBUG] Re-transcribing project ${project.id}`);
        console.log(`[DEBUG] Project details:`, {
          id: project.id,
          title: project.title,
          source_type: project.source_type,
          source_file_path: project.source_file_path,
          has_video_metadata: !!project.video_metadata,
        });
      }
      
      // Get video metadata with proper type safety
      const videoMetadataFromProject = project.video_metadata;
      const extendedVideoMetadata = videoMetadataFromProject as ExtendedVideoMetadata | null;
      
      if (debugMode && project.video_metadata) {
        try {
          console.log(`[DEBUG] Video metadata:`, {
            duration: project.video_metadata.duration,
            file_size: project.video_metadata.file_size,
            isChunked: extendedVideoMetadata?.chunking?.isChunked || false,
            chunkCount: extendedVideoMetadata?.chunking?.chunks?.length || 0
          });
        } catch (e) {
          console.log(`[DEBUG] Error parsing video metadata:`, e);
        }
      }
      
      // Fetch project videos to ensure we have all videos
      const projectVideos = await fetchProjectVideos(project.id);
      
      if (debugMode) {
        console.log(`[DEBUG] Re-transcribing project ${project.id} with ${projectVideos.length} videos`);
        
        if (projectVideos && projectVideos.length > 0) {
          console.log(`[DEBUG] Project videos:`, projectVideos.map(v => ({
            id: v.id,
            title: v.title,
            path: v.source_file_path,
            hasMetadata: !!v.video_metadata
          })));
        }
      }
      
      // Call the transcribe video service with improved error handling
      try {
        const result = await transcribeVideo(project.id, projectVideos);
        
        if (result.success && result.transcript) {
          if (debugMode) {
            console.log(`[DEBUG] Transcription succeeded. Transcript length: ${result.transcript.length} chars`);
          }
          
          // Update the local state
          setEditedTranscript(result.transcript);
          setTranscript(result.transcript);
          
          // Reload all transcripts to get the updated combined version
          await loadAllProjectTranscripts();
          
          toast.success("Video successfully re-transcribed!", { id: toastId });
        } else {
          console.error(`[DEBUG] Transcription failed:`, result.error);
          const errorMessage = result.error || "Unknown error";
          
          // Show more helpful error message for common issues
          if (errorMessage.includes("download") || errorMessage.includes("Storage access error")) {
            toast.error("Failed to access video file. It may be missing or inaccessible.", { id: toastId, duration: 6000 });
          } else if (errorMessage.includes("large")) {
            toast.error("Video file is too large for direct transcription. Try using automatic chunking.", { id: toastId, duration: 6000 });
          } else {
            toast.error(`Failed to re-transcribe video: ${errorMessage}`, { id: toastId, duration: 6000 });
          }
          
          // Show extended error details
          if (debugMode) {
            console.log(`[DEBUG] Extended error details for transcription failure:`, {
              project_id: project.id,
              error: result.error,
              videosCount: projectVideos.length,
              source_file_exists: !!project.source_file_path
            });
          }
        }
      } catch (apiError: any) {
        console.error("[DEBUG] API error re-transcribing video:", apiError);
        toast.error(`API error: ${apiError?.message || "Unknown error"}`, { 
          id: toastId, 
          duration: 6000
        });
      }
    } catch (error: any) {
      console.error("[DEBUG] Error in re-transcribe handler:", error);
      toast.error(`Error preparing transcription: ${error?.message || "Unknown error"}`, { 
        id: toastId, 
        duration: 6000
      });
    } finally {
      setIsReTranscribing(false);
    }
  };

  // Content for the component when used in tab mode
  const TabContent = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ToggleGroup variant="outline" type="single" value={previewMode ? "preview" : "edit"}>
            <ToggleGroupItem value="edit" onClick={() => setPreviewMode(false)}>Edit</ToggleGroupItem>
            <ToggleGroupItem value="preview" onClick={() => setPreviewMode(true)}>Preview</ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        <div className="flex items-center space-x-4">
          {previewMode && (
            <>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="show-timestamps" 
                  checked={showTimestamps} 
                  onCheckedChange={setShowTimestamps}
                />
                <Label htmlFor="show-timestamps">Show timestamps</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="highlight-speakers" 
                  checked={highlightSpeakers} 
                  onCheckedChange={setHighlightSpeakers}
                />
                <Label htmlFor="highlight-speakers">Highlight speakers</Label>
              </div>
            </>
          )}
          
          {/* Add debug mode toggle for advanced users */}
          <div className="flex items-center space-x-2">
            <Switch 
              id="debug-mode" 
              checked={debugMode} 
              onCheckedChange={setDebugMode}
            />
            <Label htmlFor="debug-mode" className="text-sm text-muted-foreground">Debug</Label>
          </div>
        </div>
      </div>

      {isLoadingTranscript ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p>Loading all transcripts...</p>
          </div>
        </div>
      ) : !previewMode ? (
        <>
          {hasMultipleSections && (
            <div className="mb-4 p-3 bg-muted/30 rounded-md border border-amber-200 flex items-center">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                This project contains multiple video transcripts with section headers (##). 
                These headers help organize content from different videos and should be preserved.
              </p>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('reset')}
            >
              <Undo className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('cleanup')}
            >
              <Check className="h-3 w-3 mr-1" />
              Clean up
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('speakers')}
            >
              <Check className="h-3 w-3 mr-1" />
              Format speakers
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('paragraphs')}
            >
              <ArrowDown className="h-3 w-3 mr-1" />
              Add paragraphs
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFormatTranscript('timestamps')}
            >
              <Check className="h-3 w-3 mr-1" />
              Add timestamps
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={formatAllAtOnce}
            >
              <Check className="h-3 w-3 mr-1" />
              Format all
            </Button>
          </div>
          
          <Textarea 
            value={editedTranscript}
            onChange={(e) => setEditedTranscript(e.target.value)}
            placeholder="Enter or edit the transcript here..."
            className="min-h-[350px] font-mono text-sm"
            wrap="off"
          />
        </>
      ) : (
        <div className="border rounded-md p-4 min-h-[350px] bg-muted/10 overflow-y-auto">
          <TranscriptRenderer 
            transcript={editedTranscript} 
            showTimestamps={showTimestamps}
            highlightSpeakers={highlightSpeakers}
            showVideoSeparators={true}
          />
        </div>
      )}
      
      <div className="flex justify-between mt-4">
        {debugMode && project?.video_metadata && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-muted-foreground max-w-[350px]">
            <p>Debug Info: {project.video_metadata && (project.video_metadata as ExtendedVideoMetadata)?.chunking?.isChunked ? "Video is chunked" : "Not chunked"}</p>
            <p>File size: {project.video_metadata.file_size ? `${(project.video_metadata.file_size / (1024 * 1024)).toFixed(2)} MB` : "Unknown"}</p>
            <p>Duration: {project.video_metadata.duration ? `${project.video_metadata.duration.toFixed(1)}s` : "Unknown"}</p>
          </div>
        )}
        
        {/* Add Re-Transcribe Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReTranscribe}
          disabled={isReTranscribing || !project?.source_file_path}
        >
          {isReTranscribing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Re-transcribing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Re-Transcribe Video
            </>
          )}
        </Button>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => isOpen ? null : setOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveTranscript}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : "Save Transcript"}
          </Button>
        </div>
      </div>
    </>
  );

  // For standalone mode (when used outside of the tabbed settings dialog)
  if (isOpen === undefined) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" />
            {project?.transcript ? "Edit Transcript" : "Add Transcript"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Video Transcript</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <TabContent />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // For tabbed mode
  return <TabContent />;
};
