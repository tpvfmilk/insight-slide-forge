
import { useToast as useToastHook, toast as toastHook } from "@/hooks/use-toast";

// Re-export the hooks for consistent usage across the app
export const useToast = useToastHook;
export const toast = toastHook;

// For convenience, export default toast function
export default toast;
