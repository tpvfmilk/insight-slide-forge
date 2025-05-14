
// Import from sonner directly
import { toast as sonnerToast } from "sonner";

// Create a useToast hook that returns toast function
export function useToast() {
  return {
    toast: sonnerToast
  };
}

// Export toast for direct usage
export const toast = sonnerToast;
