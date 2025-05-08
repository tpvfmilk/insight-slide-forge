
import React, { useId, useEffect } from 'react';
import { useUIReset } from '@/context/UIResetContext';
import { Sheet, SheetContent, SheetProps } from '@/components/ui/sheet';

// Extended SheetProps with onOpenChange
interface SafeSheetProps extends SheetProps {
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export const SafeSheet = ({ children, onOpenChange, open, ...props }: SafeSheetProps) => {
  const { registerUIElement, unregisterUIElement } = useUIReset();
  const id = useId();
  
  useEffect(() => {
    if (open) {
      const elementId = `sheet-${id}`;
      registerUIElement({
        id: elementId,
        type: 'sheet',
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
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      {children}
    </Sheet>
  );
};

export const SafeSheetContent = SheetContent;
