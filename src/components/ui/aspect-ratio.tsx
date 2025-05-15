
import * as React from "react"
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

const AspectRatio = AspectRatioPrimitive.Root

/**
 * VideoAspectRatio component that manages aspect ratio for video components
 * Can dynamically adjust to handle different video types including chunked videos
 */
const VideoAspectRatio = React.forwardRef<
  React.ElementRef<typeof AspectRatioPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root> & {
    isChunkedVideo?: boolean;
  }
>(({ isChunkedVideo, className, ratio = 16 / 9, ...props }, ref) => {
  // Chunked videos sometimes have different aspect ratios
  // We could adjust the ratio based on metadata if needed
  const adjustedRatio = isChunkedVideo ? 16 / 9 : ratio;
  
  return (
    <AspectRatio
      ref={ref}
      ratio={adjustedRatio}
      className={className}
      {...props}
    />
  );
})
VideoAspectRatio.displayName = "VideoAspectRatio";

export { AspectRatio, VideoAspectRatio }
