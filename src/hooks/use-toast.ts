
import { type ToastProps, type ToastActionElement } from "@/components/ui/toast";
import { useToast as useToastPrimitive } from "@/components/ui/toast";

export interface ToastOptions {
  id?: string; 
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
  action?: ToastActionElement;
}

// Create a toast function that accepts our simplified options
const toast = (options: ToastOptions) => {
  // Get the toast function from the primitive
  const { toast: toastPrimitive } = useToastPrimitive();
  
  // Call the toast function with properly mapped options
  return toastPrimitive({
    title: options.title,
    description: options.description,
    variant: options.variant as ToastProps["variant"],
    duration: options.duration,
    action: options.action,
    id: options.id,
  });
};

// Re-export the hooks from the primitive
export { useToastPrimitive as useToast, toast };
