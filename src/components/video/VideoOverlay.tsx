
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

interface VideoOverlayProps {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const VideoOverlay = ({ isLoading, error, onRetry }: VideoOverlayProps) => {
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
        <RefreshCw className="h-8 w-8 animate-spin mr-2" />
        <span>Loading video...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 text-center">
        <div>
          <AlertCircle className="h-10 w-10 mb-2 mx-auto text-destructive" />
          <p className="mb-4">{error}</p>
          <Button 
            variant="secondary" 
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Loading Video
          </Button>
        </div>
      </div>
    );
  }
  
  return null;
};
