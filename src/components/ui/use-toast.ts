
// Import from sonner directly
import { toast } from "sonner";
import { useToast as useRadixToast } from "@/hooks/use-toast";

// Re-export for compatibility
export { toast, useToast };

// Re-export the useToast function for backward compatibility
export function useToast() {
  return useRadixToast();
}
