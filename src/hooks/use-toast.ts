// This file is now just a compatibility layer that re-exports sonner
// to maintain backward compatibility with any code still using it
// Long-term we should transition all code to import directly from sonner
import { toast as sonnerToast, type ToastT } from "sonner";

// Re-export toast from sonner with correct type definitions
export const toast = Object.assign(
  // Main toast function with both formats
  (props: string | React.ReactNode | ToastT | { title?: string; description?: string; variant?: "default" | "destructive" }) => {
    if (typeof props === "string" || React.isValidElement(props)) {
      return sonnerToast(props);
    } else if (props && typeof props === "object") {
      // Handle the legacy format with title/description/variant
      if ("title" in props || "description" in props) {
        const { title, description, variant, ...rest } = props as { 
          title?: string; 
          description?: string; 
          variant?: "default" | "destructive";
          [key: string]: any;
        };
        
        // If destructive variant, use the sonner destructive style
        if (variant === "destructive") {
          return sonnerToast.error(title || "", { 
            description,
            ...rest
          });
        }
        
        // Default case
        return sonnerToast(title || "", { 
          description,
          ...rest
        });
      }
      // Otherwise it's already in sonner format
      return sonnerToast(props as ToastT);
    }
    return sonnerToast(props as any);
  },
  // Add all the utility functions from sonner
  ...Object.entries(sonnerToast).reduce((acc, [key, fn]) => {
    acc[key] = fn;
    return acc;
  }, {} as any)
);

// For components still using useToast
export const useToast = () => {
  return {
    toast,
    // Provide a dismiss function for compatibility
    dismiss: (toastId?: string) => {
      if (toastId) {
        toast.dismiss(toastId);
      } else {
        toast.dismiss();
      }
    }
  };
};
