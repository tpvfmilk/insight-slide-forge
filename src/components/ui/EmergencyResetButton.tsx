import React from 'react';
import { useUIReset } from '@/context/UIResetContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
export function EmergencyResetButton() {
  const {
    resetAllUI,
    isEmergencyVisible
  } = useUIReset();
  if (!isEmergencyVisible) {
    return null;
  }
  return <div className={cn("fixed bottom-4 right-4 z-[1000] transition-all", "animate-pulse hover:animate-none", "drop-shadow-lg")}>
      <Button onClick={resetAllUI} variant="destructive" size="sm" className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Reset UI
      </Button>
    </div>;
}