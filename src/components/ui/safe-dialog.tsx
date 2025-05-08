
import React, { useId, useEffect } from 'react';
import { useUIReset } from '@/context/UIResetContext';
import { Dialog, DialogContent, DialogProps } from '@/components/ui/dialog';
import { v4 as uuidv4 } from 'uuid';

// Extended DialogProps with onOpenChange
interface SafeDialogProps extends DialogProps {
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export const SafeDialog = ({ children, onOpenChange, open, ...props }: SafeDialogProps) => {
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
      {children}
    </Dialog>
  );
};

export const SafeDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ children, ...props }, ref) => {
  return <DialogContent ref={ref} {...props}>{children}</DialogContent>;
});
SafeDialogContent.displayName = 'SafeDialogContent';
