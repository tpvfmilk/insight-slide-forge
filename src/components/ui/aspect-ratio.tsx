
import * as React from "react"
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

interface AspectRatioProps extends React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root> {
  className?: string;
}

const AspectRatio = React.forwardRef<
  React.ElementRef<typeof AspectRatioPrimitive.Root>,
  AspectRatioProps
>(({ className, ...props }, ref) => (
  <AspectRatioPrimitive.Root
    ref={ref}
    className={className}
    {...props}
  />
))
AspectRatio.displayName = "AspectRatio"

export { AspectRatio }
