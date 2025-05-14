
// Import from sonner instead of radix-ui
import { toast as sonnerToast } from "sonner";
import { useToast as useRadixToast } from "@/components/ui/toast";

// Re-export with compatibility layer
export const toast = sonnerToast;
export const useToast = useRadixToast;
