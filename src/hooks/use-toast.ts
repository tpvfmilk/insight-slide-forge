
// This file re-exports the toast functionality from the UI components
import { useToast as useToastOriginal, toast as toastOriginal } from "@/components/ui/use-toast";

export const useToast = useToastOriginal;
export const toast = toastOriginal;
