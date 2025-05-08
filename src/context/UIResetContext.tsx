
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { toast } from "sonner";
import { forceRemoveUIBlockers } from "@/utils/uiUtils";

// Type for the UI elements that can be registered
type RegisteredUIElement = {
  id: string;
  type: 'dialog' | 'drawer' | 'sheet' | 'popover' | 'dropdown' | 'modal';
  close: () => void;
};

interface UIResetContextType {
  registerUIElement: (element: RegisteredUIElement) => void;
  unregisterUIElement: (id: string) => void;
  resetAllUI: () => void;
  activeUIElements: RegisteredUIElement[];
  isEmergencyVisible: boolean;
}

const UIResetContext = createContext<UIResetContextType | undefined>(undefined);

export const useUIReset = () => {
  const context = useContext(UIResetContext);
  if (!context) {
    throw new Error('useUIReset must be used within a UIResetProvider');
  }
  return context;
};

interface UIResetProviderProps {
  children: ReactNode;
}

export const UIResetProvider = ({ children }: UIResetProviderProps) => {
  const [activeUIElements, setActiveUIElements] = useState<RegisteredUIElement[]>([]);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const consecutiveEscCount = useRef(0);
  const escapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const registerUIElement = (element: RegisteredUIElement) => {
    setActiveUIElements(prev => {
      // Don't add duplicates
      if (prev.some(e => e.id === element.id)) {
        return prev;
      }
      return [...prev, element];
    });
  };

  const unregisterUIElement = (id: string) => {
    setActiveUIElements(prev => prev.filter(element => element.id !== id));
  };

  const resetAllUI = () => {
    // Close all UI elements in reverse order (usually nested ones should close first)
    [...activeUIElements].reverse().forEach(element => {
      try {
        element.close();
      } catch (error) {
        console.error(`Failed to close UI element ${element.id}:`, error);
      }
    });
    
    // Use our enhanced utility function to force remove UI blockers
    forceRemoveUIBlockers();

    // Reset active elements state
    setActiveUIElements([]);
    
    // Show success toast
    toast.success("UI successfully reset", {
      description: "All dialogs and overlays have been closed."
    });
  };

  // Listen for Escape key presses
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Count consecutive Escape presses
        consecutiveEscCount.current += 1;
        
        // Clear previous timeout
        if (escapeTimeoutRef.current) {
          clearTimeout(escapeTimeoutRef.current);
        }
        
        // If Escape is pressed 3 times quickly, reset all UI
        if (consecutiveEscCount.current >= 3) {
          resetAllUI();
          consecutiveEscCount.current = 0;
        } else {
          // Reset counter after 500ms
          escapeTimeoutRef.current = setTimeout(() => {
            consecutiveEscCount.current = 0;
          }, 500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (escapeTimeoutRef.current) {
        clearTimeout(escapeTimeoutRef.current);
      }
    };
  }, []);

  // More aggressively check for blocked UI
  useEffect(() => {
    // Show emergency button if there are active UI elements
    setIsEmergencyVisible(activeUIElements.length > 0);
    
    // Also periodically check for blocking UI elements that might not be registered
    const checkForBlockingUI = () => {
      // Look for various indicators of blocking UI
      const hasOpenDialogs = document.querySelectorAll('[data-state="open"]').length > 0;
      const hasFixedOverlays = Array.from(document.querySelectorAll('div')).some(div => {
        const style = window.getComputedStyle(div as HTMLElement);
        return (
          style.position === 'fixed' && 
          style.backgroundColor.includes('rgba') &&
          style.top === '0px' && 
          style.left === '0px' &&
          (style.right === '0px' || style.width === '100%') &&
          (style.bottom === '0px' || style.height === '100%')
        );
      });
      
      // Show emergency button if we detect UI blockers
      if ((hasOpenDialogs || hasFixedOverlays) && activeUIElements.length === 0) {
        setIsEmergencyVisible(true);
      }
    };
    
    // Check immediately and then periodically
    checkForBlockingUI();
    const interval = setInterval(checkForBlockingUI, 2000);
    
    return () => {
      clearInterval(interval);
    };
  }, [activeUIElements.length]);
  
  // Global click handler to detect possible stuck UI states
  useEffect(() => {
    const handleGlobalClick = () => {
      const blockedUI = document.querySelectorAll('[data-state="open"]');
      const blockedOverlays = document.querySelectorAll('[role="dialog"], [aria-hidden="true"]');
      
      // If we detect open UI elements but no registered active elements,
      // something might be stuck
      if ((blockedUI.length > 0 || blockedOverlays.length > 0) && activeUIElements.length === 0) {
        setIsEmergencyVisible(true);
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [activeUIElements.length]);

  const value = {
    registerUIElement,
    unregisterUIElement,
    resetAllUI,
    activeUIElements,
    isEmergencyVisible,
  };

  return (
    <UIResetContext.Provider value={value}>
      {children}
    </UIResetContext.Provider>
  );
};
