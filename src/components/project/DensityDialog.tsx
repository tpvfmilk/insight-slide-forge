
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SlidersIcon, RefreshCw } from "lucide-react";
import { Project } from "@/services/projectService";
import { updateProject } from "@/services/uploadService";
import { toast } from "sonner";

interface DensityDialogProps {
  project: Project | null;
  slidesPerMinute: number;
  setSlidesPerMinute: (value: number) => void;
}

export const DensityDialog = ({ project, slidesPerMinute, setSlidesPerMinute }: DensityDialogProps) => {
  const [isDensityDialogOpen, setIsDensityDialogOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveDensity = async () => {
    if (!project?.id) return;
    
    setIsSaving(true);
    
    try {
      await updateProject(project.id, {
        slides_per_minute: slidesPerMinute
      });
      
      toast.success("Slides per minute setting saved");
      setIsDensityDialogOpen(false);
    } catch (error) {
      console.error("Error saving density setting:", error);
      toast.error("Failed to save slides per minute setting");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isDensityDialogOpen} onOpenChange={setIsDensityDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersIcon className="h-4 w-4 mr-1" />
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
  );
};
