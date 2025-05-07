
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Image } from "lucide-react";
import { createProjectFromTranscript } from "@/services/uploadService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const TranscriptUpload = () => {
  const [transcriptText, setTranscriptText] = useState<string>("");
  const navigate = useNavigate();
  
  const handleTranscriptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transcriptText.trim()) {
      toast.error("Please enter transcript text");
      return;
    }
    
    try {
      // Create project from transcript text
      const project = await createProjectFromTranscript(transcriptText);
      
      if (project) {
        toast.success("Transcript received. Processing...");
        navigate(`/projects/${project.id}`);
      }
    } catch (error) {
      toast.error("Failed to process transcript");
      console.error("Transcript processing error:", error);
    }
  };

  return (
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
  );
};
