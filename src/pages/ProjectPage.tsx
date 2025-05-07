import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Project, fetchProjectById, updateProject } from "@/services/projectService";
import { toast } from "sonner";
import { SlideEditor } from "@/components/slides/SlideEditor";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Settings2, FileText, SliderIcon } from "lucide-react";
import { generateSlidesForProject, hasValidSlides } from "@/services/slideGenerationService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ContextPromptInput } from "@/components/upload/ContextPromptInput";
import { transcribeVideo } from "@/services/uploadService";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

const ProjectPage = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState<boolean>(false);
  const [isDensityDialogOpen, setIsDensityDialogOpen] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [slidesPerMinute, setSlidesPerMinute] = useState<number>(6);
  
  const loadProject = async () => {
    if (!projectId) return;
    
    try {
      setIsLoading(true);
      const projectData = await fetchProjectById(projectId);
      
      if (!projectData) {
        toast.error("Project not found");
        navigate("/projects");
        return;
      }
      
      setProject(projectData);
      setContextPrompt(projectData.context_prompt || "");
      setTranscript(projectData.transcript || "");
      setSlidesPerMinute(projectData.slides_per_minute || 6);
      
      // For new projects, check if we need to transcribe or generate slides
      const isNewlyCreated = Date.now() - new Date(projectData.created_at).getTime() < 60000; // Within a minute
      
      if (isNewlyCreated) {
        // If video upload with no transcript, try to transcribe
        if (projectData.source_type === 'video' && !projectData.transcript) {
          handleTranscribeVideo();
        }
        // If has transcript but no slides, generate slides
        else if (projectData.transcript && !hasValidSlides(projectData)) {
          handleGenerateSlides();
        }
      }
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadProject();
  }, [projectId]);
  
  const handleGenerateSlides = async () => {
    if (!projectId || isGenerating) return;
    
    setIsGenerating(true);
    
    try {
      const result = await generateSlidesForProject(projectId);
      
      if (result.success && result.slides) {
        // Update the project in state with the new slides
        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            slides: result.slides
          };
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

  const handleSaveContext = async () => {
    if (!projectId || !project) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(projectId, {
        context_prompt: contextPrompt
      });
      
      toast.success("Context prompt saved");
      setIsDialogOpen(false);
      
      // Update the project in state with the new context
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          context_prompt: contextPrompt
        };
      });
    } catch (error) {
      console.error("Error saving context:", error);
      toast.error("Failed to save context prompt");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveTranscript = async () => {
    if (!projectId || !project) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(projectId, {
        transcript: transcript
      });
      
      toast.success("Transcript saved");
      setIsTranscriptDialogOpen(false);
      
      // Update the project in state with the new transcript
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          transcript: transcript
        };
      });
    } catch (error) {
      console.error("Error saving transcript:", error);
      toast.error("Failed to save transcript");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveDensity = async () => {
    if (!projectId || !project) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(projectId, {
        slides_per_minute: slidesPerMinute
      });
      
      toast.success("Slides per minute setting saved");
      setIsDensityDialogOpen(false);
      
      // Update the project in state with the new setting
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          slides_per_minute: slidesPerMinute
        };
      });
    } catch (error) {
      console.error("Error saving density setting:", error);
      toast.error("Failed to save slides per minute setting");
    } finally {
      setIsSaving(false);
    }
  };
  
  const needsTranscription = project?.source_type === 'video' && !project?.transcript;
  
  return (
    <InsightLayout>
      <div className="h-full flex flex-col">
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="outline" size="sm" asChild className="mr-4">
              <a onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </a>
            </Button>
            
            <div>
              <h1 className="text-xl font-semibold truncate">
                {isLoading ? "Loading..." : project?.title || "Untitled Project"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {project?.source_type === 'video' ? 'From video upload' : 
                 project?.source_type === 'url' ? 'From URL' : 
                 project?.source_type === 'transcript' ? 'From transcript' : 'Unknown source'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Transcript Dialog */}
            <Dialog open={isTranscriptDialogOpen} onOpenChange={setIsTranscriptDialogOpen}>
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
                  <Textarea 
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Enter or edit the transcript here..."
                    className="min-h-[400px]"
                  />
                  
                  <div className="flex justify-end mt-4 space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsTranscriptDialogOpen(false)}
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
              </DialogContent>
            </Dialog>
            
            {/* Slide Density Dialog */}
            <Dialog open={isDensityDialogOpen} onOpenChange={setIsDensityDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <SliderIcon className="h-4 w-4 mr-1" />
                  Slide Density
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Slide Density Control</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Adjust how many slides are generated per minute of content.
                        Higher values create more detailed slides, while lower values create
                        more summarized content.
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">1</span>
                      <Slider
                        value={[slidesPerMinute]}
                        min={1}
                        max={20}
                        step={1}
                        onValueChange={(values) => setSlidesPerMinute(values[0])}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">20</span>
                      <span className="w-8 text-right text-sm font-medium">{slidesPerMinute}</span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground italic">
                      Changes will apply the next time slides are generated.
                    </p>
                  </div>
                  
                  <div className="flex justify-end mt-4 space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDensityDialogOpen(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveDensity}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : "Save Setting"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Context Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-1" />
                  Context Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Slide Generation Context</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <ContextPromptInput 
                    value={contextPrompt}
                    onChange={setContextPrompt}
                  />
                  
                  <div className="flex justify-end mt-4 space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveContext}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : "Save Context"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Transcribe Button */}
            {needsTranscription && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTranscribeVideo} 
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-1" />
                    Transcribe Video
                  </>
                )}
              </Button>
            )}
            
            {/* Generate Slides Button */}
            <Button 
              variant={needsTranscription ? "outline" : "default"} 
              size="sm" 
              onClick={handleGenerateSlides} 
              disabled={isGenerating || (project?.source_type === 'video' && !project?.transcript)}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Generate Slides
                </>
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
                <p className="text-sm text-muted-foreground">Loading project...</p>
              </div>
            </div>
          ) : (
            <SlideEditor />
          )}
        </div>
      </div>
    </InsightLayout>
  );
};

export default ProjectPage;
