
import { InsightLayout } from "@/components/layout/InsightLayout";
import { VideoUpload } from "@/components/upload/VideoUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const UploadPage = () => {
  return (
    <InsightLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Upload</h1>
          <p className="text-muted-foreground">
            Upload a video for slide generation
          </p>
        </div>
        
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Upload Video Content</CardTitle>
            <CardDescription>
              Upload a video for slide generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VideoUpload />
          </CardContent>
        </Card>
      </div>
    </InsightLayout>
  );
};

export default UploadPage;
