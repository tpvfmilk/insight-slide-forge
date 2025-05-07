
import { InsightLayout } from "@/components/layout/InsightLayout";
import { UploadForm } from "@/components/upload/UploadForm";

const UploadPage = () => {
  return (
    <InsightLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Upload</h1>
          <p className="text-muted-foreground">
            Upload video content or transcripts for slide generation
          </p>
        </div>
        
        <UploadForm />
      </div>
    </InsightLayout>
  );
};

export default UploadPage;
