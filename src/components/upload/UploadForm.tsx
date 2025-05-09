
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { VideoUpload } from "./VideoUpload";
import { YoutubeUpload } from "./YoutubeUpload";
import { TranscriptExtractor } from "./TranscriptExtractor";

export const UploadForm = () => {
  const [uploadMethod, setUploadMethod] = useState<string>("video");
  
  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Video Content</CardTitle>
        <CardDescription>
          Upload video content or extract transcripts for slide generation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={uploadMethod} onValueChange={setUploadMethod}>
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="video">Video Upload</TabsTrigger>
            <TabsTrigger value="youtube">YouTube/Vimeo</TabsTrigger>
            <TabsTrigger value="extract">Extract Transcript</TabsTrigger>
          </TabsList>
          
          <TabsContent value="video">
            <VideoUpload />
          </TabsContent>
          
          <TabsContent value="youtube">
            <YoutubeUpload />
          </TabsContent>
          
          <TabsContent value="extract">
            <TranscriptExtractor />
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
