
// Import from sonner directly
import { toast } from "sonner";

// Export for use throughout the app
export { toast };

// Re-export the useToast function for backward compatibility
export function useToast() {
  return { toast };
}
