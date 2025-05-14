
import React from "react";
import { Slide } from "../slides/editor/SlideEditorTypes";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface SlidePreviewProps {
  slides?: Slide[];
  currentSlide: Slide;
}

export const SlidePreview: React.FC<SlidePreviewProps> = ({ currentSlide }) => {
  if (!currentSlide) return null;
  
  // Collect all images from both imageUrl and imageUrls
  const allImages: string[] = [];
  if (currentSlide.imageUrl) allImages.push(currentSlide.imageUrl);
  if (currentSlide.imageUrls) allImages.push(...currentSlide.imageUrls);
  
  const hasImages = allImages.length > 0;
  const hasSingleImage = allImages.length === 1;
  
  return (
    <div className="w-full h-full flex items-center justify-center p-4 bg-black text-white">
      <div className="w-full max-w-5xl mx-auto">
        {hasImages ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side: Image grid */}
            <div className="space-y-4">
              {hasSingleImage ? (
                // Single image - take full width of the container
                <div className="w-full rounded-md overflow-hidden border border-white/10">
                  <AspectRatio ratio={16/9}>
                    <img 
                      src={allImages[0]}
                      alt="Slide image"
                      className="w-full h-full object-cover"
                    />
                  </AspectRatio>
                </div>
              ) : (
                // Multiple images - use grid layout
                <div className="grid grid-cols-2 gap-3">
                  {allImages.map((imageUrl, index) => (
                    <div key={index} className="rounded-md overflow-hidden border border-white/10">
                      <AspectRatio ratio={16/9}>
                        <img 
                          src={imageUrl} 
                          alt={`Slide image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </AspectRatio>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Right side: Slide content */}
            <div className="flex flex-col p-4 space-y-4">
              <h2 className="text-2xl font-semibold">{currentSlide.title}</h2>
              <div className="mt-2 whitespace-pre-wrap">{currentSlide.content}</div>
            </div>
          </div>
        ) : (
          // No images - center the content
          <div className="text-center p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">{currentSlide.title}</h2>
            <div className="mt-2 whitespace-pre-wrap">{currentSlide.content}</div>
          </div>
        )}
      </div>
    </div>
  );
};
