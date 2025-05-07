
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, FileVideo, Upload, Youtube, Image, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export const UploadForm = () => {
  const [uploadMethod, setUploadMethod] = useState<string>("video");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // Check file type
    if (!file.type.includes('video/')) {
      toast.error("Please upload a video file");
      return;
    }
    
    // Check file size (limit to 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be less than 100MB");
      return;
    }
    
    simulateUpload();
  };

  const handleYouTubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoUrl) {
      toast.error("Please enter a YouTube or Vimeo URL");
      return;
    }
    
    // Simple validation for YouTube/Vimeo URLs
    const isValidUrl = videoUrl.includes('youtube.com') || 
                       videoUrl.includes('youtu.be') || 
                       videoUrl.includes('vimeo.com');
                       
    if (!isValidUrl) {
      toast.error("Please enter a valid YouTube or Vimeo URL");
      return;
    }
    
    simulateUpload();
  };
  
  const handleTranscriptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transcriptText.trim()) {
      toast.error("Please enter transcript text");
      return;
    }
    
    // Process transcript directly
    toast.success("Transcript received. Proceeding to preprocessing.");
    
    // Here we would redirect to transcript editing or directly to AI processing
  };
  
  const simulateUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + 10;
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            toast.success("Upload complete! Processing video...");
          }, 500);
          return 100;
        }
        
        return newProgress;
      });
    }, 300);
  };
  
  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Video Content</CardTitle>
        <CardDescription>
          Upload video content or provide a transcript for slide generation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={uploadMethod} onValueChange={setUploadMethod}>
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="video">Video Upload</TabsTrigger>
            <TabsTrigger value="youtube">YouTube/Vimeo</TabsTrigger>
            <TabsTrigger value="transcript">Direct Transcript</TabsTrigger>
          </TabsList>
          
          <TabsContent value="video">
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
              <FileVideo className="h-8 w-8 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">Upload a video file</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                MP4 or WebM format, up to 100MB
              </p>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                className="sr-only" 
                accept="video/*"
              />
              <Button onClick={handleFileButtonClick} disabled={isUploading}>
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              
              {isUploading && (
                <div className="w-full mt-6 space-y-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="youtube">
            <form onSubmit={handleYouTubeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="video-url" className="text-sm font-medium">
                  YouTube or Vimeo URL
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="video-url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="pl-9"
                      disabled={isUploading}
                    />
                  </div>
                  <Button type="submit" disabled={isUploading}>
                    {isUploading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Process
                  </Button>
                </div>
              </div>
              
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Processing video...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
            </form>
          </TabsContent>
          
          <TabsContent value="transcript">
            <form onSubmit={handleTranscriptSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="transcript-text" className="text-sm font-medium">
                  Transcript Text
                </label>
                <Textarea 
                  id="transcript-text"
                  placeholder="Paste or type your transcript here..."
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              
              <div className="flex gap-4">
                <Button type="button" variant="outline" className="flex-1">
                  <Image className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
                <Button type="submit" className="flex-1">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Process Transcript
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4 mr-1" />
          <span>Projects expire after 48 hours</span>
        </div>
        <Button variant="outline" asChild>
          <a href="https://docs.example.com" target="_blank" rel="noreferrer">
            Learn More
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
};
