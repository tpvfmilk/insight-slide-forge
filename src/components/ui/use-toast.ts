
// This file now just re-exports from sonner to maintain back-compatibility
import { toast } from "sonner";

// Re-export the toast function
export { toast };

// Export useToast for components that still need it
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
    },
    // Empty toasts array for compatibility with old API
    toasts: []
  };
};
