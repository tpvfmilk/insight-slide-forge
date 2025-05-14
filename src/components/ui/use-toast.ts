
// Correctly import from sonner
import { toast as sonnerToast } from "sonner";
import { type ToastProps } from "@/components/ui/toast";

// Re-export toast from sonner for compatibility
export { toast } from "sonner";

// Define the toast action props
export type ToastActionProps = React.ComponentProps<"button">;

// Custom hook that provides a compatibility layer between shadcn/ui toast API and sonner
export const useToast = () => {
  return {
    toast: (props: {
      title?: React.ReactNode;
      description?: React.ReactNode;
      action?: React.ReactNode;
      duration?: number;
    }) => {
      // We use sonner as our toast library
      return sonnerToast(props.title as string, {
        description: props.description,
        duration: props.duration,
        action: props.action,
      });
    },
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
  };
};
