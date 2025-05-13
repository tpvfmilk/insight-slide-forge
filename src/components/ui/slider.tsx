
import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  // Improved track click handler with proper positioning calculation
  const handleTrackClick = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation(); // Stop event propagation
    
    // Get the track element
    const trackElement = e.currentTarget;
    const trackRect = trackElement.getBoundingClientRect();
    
    // Calculate relative position within the track (0 to 1)
    const relativePosition = (e.clientX - trackRect.left) / trackRect.width;
    
    // Calculate the value based on the slider's min, max, and step
    const min = props.min || 0;
    const max = props.max || 100;
    const calculatedValue = min + relativePosition * (max - min);
    
    // If onValueChange callback exists, call it with the new value
    if (props.onValueChange) {
      props.onValueChange([calculatedValue]);
    }
    
    // If onValueCommit exists, call it to commit the value
    if (props.onValueCommit) {
      props.onValueCommit([calculatedValue]);
    }
  };
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track 
        className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary"
        onPointerDown={handleTrackClick}
      >
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" 
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
