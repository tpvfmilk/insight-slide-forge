
// This file is now just a compatibility layer that re-exports sonner
// to maintain backward compatibility with any code still using it
// Long-term we should transition all code to import directly from sonner
import { toast as sonnerToast } from "sonner";

// Re-export toast from sonner
export const toast = sonnerToast;

// For components still using useToast
export const useToast = () => {
  return {
    toast: sonnerToast,
    // Provide a dismiss function for compatibility
    dismiss: (toastId?: string) => {
      if (toastId) {
        sonnerToast.dismiss(toastId);
      } else {
        sonnerToast.dismiss();
      }
    }
  };
};
