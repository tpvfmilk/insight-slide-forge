
import { useState } from "react";
import { RefreshCw, Upload, Film, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadSlideImage } from "@/services/imageService";
import { Slide, LocalExtractedFrame } from "@/hooks/useSlides";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

interface SlideImagesProps {
  currentSlide: Slide;
  slides: Slide[];
  currentSlideIndex: number;
  updateSlidesInDatabase: (slides: Slide[]) => Promise<void>;
  handleSelectFrames: () => void;
  mergeFramesWithLibrary: (frames: ExtractedFrame[]) => Promise<LocalExtractedFrame[]>;
  removeImage: (imageUrl: string) => Promise<void>;
  isSyncingFrames: boolean;
  fetchProjectSize: () => Promise<void>;
}

export const SlideImages = ({
  currentSlide,
  slides,
  currentSlideIndex,
  updateSlidesInDatabase,
  handleSelectFrames,
  mergeFramesWithLibrary,
  removeImage,
  isSyncingFrames,
  fetchProjectSize
}: SlideImagesProps) => {
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const file = event.target.files[0];
    try {
      setIsUploadingImage(true);
      toast.loading("Uploading image...", {
        id: "upload-image"
      });
      const uploadResult = await uploadSlideImage(file);
      if (!uploadResult) {
        throw new Error("Failed to upload image");
      }

      // Update the current slide with the image URL
      const updatedSlides = [...slides];

      // Check if the slide already has images
      if (updatedSlides[currentSlideIndex].imageUrls && updatedSlides[currentSlideIndex].imageUrls!.length > 0) {
        // Add to the existing imageUrls array
        updatedSlides[currentSlideIndex] = {
          ...updatedSlides[currentSlideIndex],
          imageUrls: [...updatedSlides[currentSlideIndex].imageUrls!, uploadResult.url]
        };
      } else if (updatedSlides[currentSlideIndex].imageUrl) {
        // Convert from single imageUrl to imageUrls array
        updatedSlides[currentSlideIndex] = {
          ...updatedSlides[currentSlideIndex],
          imageUrls: [updatedSlides[currentSlideIndex].imageUrl!, uploadResult.url],
          imageUrl: undefined // Clear the single imageUrl
        };
      } else {
        // First image for this slide
        updatedSlides[currentSlideIndex] = {
          ...updatedSlides[currentSlideIndex],
          imageUrls: [uploadResult.url]
        };
      }
      
      updateSlidesInDatabase(updatedSlides);
      toast.success("Image uploaded successfully!", {
        id: "upload-image"
      });
      
      // Add the image as a frame in our frame library too
      const newFrame: LocalExtractedFrame = {
        id: `uploaded-${Date.now()}`,
        imageUrl: uploadResult.url,
        timestamp: new Date().toISOString(),
        isPlaceholder: false
      };
      
      await mergeFramesWithLibrary([newFrame]);
      
      // Update project size
      fetchProjectSize();
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(`Failed to upload image: ${error.message}`, {
        id: "upload-image"
      });
    } finally {
      setIsUploadingImage(false);
    }
  };
  
  return (
    <div className="w-full flex flex-col h-full p-6">
      {/* Images header with consistent spacing */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg">Images</h3>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSelectFrames}
            disabled={isUploadingImage || isSyncingFrames}
          >
            {isSyncingFrames ? (
              <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Film className="h-3.5 w-3.5 mr-1" />
            )}
            Select Frames
          </Button>
          <label>
            <input 
              type="file" 
              accept="image/*"
              className="hidden" 
              onChange={handleImageUpload}
              disabled={isUploadingImage}
            />
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={isUploadingImage}
            >
              <span>
                {isUploadingImage ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    Upload
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>
      </div>
      
      {/* Image gallery with proper padding */}
      <div className="flex-1 overflow-y-auto pb-4">
        {currentSlide && (
          <div className="grid grid-cols-2 gap-4">
            {/* Show from imageUrl (legacy) */}
            {currentSlide.imageUrl && (
              <div className="relative group aspect-video rounded-md overflow-hidden border">
                <img 
                  src={currentSlide.imageUrl} 
                  alt="Slide image"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="destructive"
                    size="sm"
                    className="h-7"
                    onClick={() => removeImage(currentSlide.imageUrl!)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            )}
            
            {/* Show from imageUrls (new approach) */}
            {currentSlide.imageUrls && currentSlide.imageUrls.map((url, i) => (
              <div key={i} className="relative group aspect-video rounded-md overflow-hidden border">
                <img 
                  src={url} 
                  alt={`Slide image ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="destructive"
                    size="sm"
                    className="h-7"
                    onClick={() => removeImage(url)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            
            {(!currentSlide.imageUrl && (!currentSlide.imageUrls || currentSlide.imageUrls.length === 0)) && (
              <div className="col-span-2 border border-dashed rounded-md p-8 flex flex-col items-center justify-center text-muted-foreground">
                <Film className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No images for this slide</p>
                <p className="text-xs mt-1">Upload an image or select frames from the video</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
