
import React, { useId, useEffect } from 'react';
import { useUIReset } from '@/context/UIResetContext';
import { Dialog, DialogContent, DialogPortal } from '@/components/ui/dialog';

// Define DialogProps interface since it's not exported from dialog.tsx
interface DialogProps extends React.ComponentPropsWithoutRef<typeof Dialog> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Extended DialogProps with onOpenChange
interface SafeDialogProps extends DialogProps {
  children: React.ReactNode;
  className?: string;
}

export const SafeDialog = ({ children, onOpenChange, open, className, ...props }: SafeDialogProps) => {
  const { registerUIElement, unregisterUIElement } = useUIReset();
  const id = useId();
  
  useEffect(() => {
    if (open) {
      const elementId = `dialog-${id}`;
      registerUIElement({
        id: elementId,
        type: 'dialog',
        close: () => {
          if (onOpenChange) {
            onOpenChange(false);
          }
        },
      });
      
      return () => {
        unregisterUIElement(elementId);
      };
    }
  }, [open, id, registerUIElement, unregisterUIElement, onOpenChange]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <div className={className}>{children}</div>
    </Dialog>
  );
};

export const SafeDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ children, ...props }, ref) => {
  return (
    <DialogContent ref={ref} {...props}>
      {children}
    </DialogContent>
  );
});
SafeDialogContent.displayName = 'SafeDialogContent';
