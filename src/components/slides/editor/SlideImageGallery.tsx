
import React from "react";
import { Button } from "@/components/ui/button";
import { Film, ImageIcon, RefreshCw, Trash2, Upload } from "lucide-react";
import { useSlideEditor } from "./SlideEditorContext";

export const SlideImageGallery: React.FC = () => {
  const {
    currentSlide,
    isUploadingImage,
    handleSelectFrames,
    handleImageUpload,
    removeImage,
  } = useSlideEditor();

  // Create a file input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {/* Images header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg">Images</h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSelectFrames}
            >
              <Film className="h-3.5 w-3.5 mr-1.5" />
              Select Frames
            </Button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*"
              className="hidden" 
              onChange={handleImageUpload}
              disabled={isUploadingImage}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={triggerFileInput}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Image gallery */}
        <div className="flex-1 overflow-y-auto pr-2">
          {currentSlide && (
            <div className="grid grid-cols-2 gap-5">
              {/* Show from imageUrl (legacy) */}
              {currentSlide.imageUrl && (
                <ImageItem 
                  url={currentSlide.imageUrl} 
                  index={0} 
                  onRemove={removeImage}
                />
              )}
              
              {/* Show from imageUrls (new approach) */}
              {currentSlide.imageUrls && currentSlide.imageUrls.map((url, i) => (
                <ImageItem 
                  key={i} 
                  url={url} 
                  index={i + 1} 
                  onRemove={removeImage}
                />
              ))}
              
              {/* Empty state */}
              {(!currentSlide.imageUrl && (!currentSlide.imageUrls || currentSlide.imageUrls.length === 0)) && (
                <div className="col-span-full flex items-center justify-center h-40 border rounded-md bg-muted/20">
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No images for this slide</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Image item component
interface ImageItemProps {
  url: string;
  index: number;
  onRemove: (url: string) => void;
}

const ImageItem: React.FC<ImageItemProps> = ({ url, index, onRemove }) => {
  return (
    <div className="relative group aspect-video rounded-md overflow-hidden border shadow-sm">
      <img 
        src={url} 
        alt={`Slide image ${index}`}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="destructive"
          size="sm"
          className="h-8"
          onClick={() => onRemove(url)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Remove
        </Button>
      </div>
    </div>
  );
};
