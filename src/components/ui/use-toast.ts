
// Correct implementation to avoid circular imports
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";

// Re-export from our compatibility layer
export { toast } from "sonner";

export type ToastActionProps = React.ComponentPropsWithoutRef<typeof ToastActionElement>;

export const useToast = () => {
  return {
    toast: (props: ToastProps) => {
      // We use a compatibility layer to provide the same API as radix-ui/react-toast
      return toast(props.title, {
        description: props.description,
        duration: props.duration,
        action: props.action,
      });
    },
    dismiss: (toastId?: string) => toast.dismiss(toastId),
  };
};
