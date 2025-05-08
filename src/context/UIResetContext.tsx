
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { toast } from "sonner";
import { forceRemoveUIBlockers, detectBlockingUI } from "@/utils/uiUtils";

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
  const periodicCheckRef = useRef<NodeJS.Timeout | null>(null);

  const registerUIElement = (element: RegisteredUIElement) => {
    console.log("Registering UI element:", element);
    setActiveUIElements(prev => {
      // Don't add duplicates
      if (prev.some(e => e.id === element.id)) {
        return prev;
      }
      return [...prev, element];
    });
  };

  const unregisterUIElement = (id: string) => {
    console.log("Unregistering UI element:", id);
    setActiveUIElements(prev => prev.filter(element => element.id !== id));
  };

  const resetAllUI = () => {
    console.log("Resetting all UI elements...");
    // Close all UI elements in reverse order (usually nested ones should close first)
    [...activeUIElements].reverse().forEach(element => {
      try {
        console.log("Closing element:", element);
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
    
    // Reset emergency visibility state
    setIsEmergencyVisible(false);
  };

  // Listen for Escape key presses
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Count consecutive Escape presses
        consecutiveEscCount.current += 1;
        console.log("Escape pressed, count:", consecutiveEscCount.current);
        
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
    console.log("Setting up UI blocking detection");
    
    // Show emergency button if there are active UI elements
    setIsEmergencyVisible(activeUIElements.length > 0);
    
    // Perform an immediate check for UI blockers
    const checkForBlockingUI = () => {
      const isBlocked = detectBlockingUI();
      
      if (isBlocked && !isEmergencyVisible) {
        console.log("Detected blocking UI, showing emergency button");
        setIsEmergencyVisible(true);
      }
    };
    
    // Check immediately and set up periodic check
    checkForBlockingUI();
    
    // Set up periodic checks every 2 seconds
    if (periodicCheckRef.current) {
      clearInterval(periodicCheckRef.current);
    }
    
    periodicCheckRef.current = setInterval(() => {
      checkForBlockingUI();
    }, 2000);
    
    return () => {
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
      }
    };
  }, [activeUIElements.length, isEmergencyVisible]);
  
  // Check after any route change or navigation
  useEffect(() => {
    const handleRouteChange = () => {
      // If we detect we've navigated but there are still active UI elements,
      // we should clean them up
      if (activeUIElements.length > 0) {
        console.log("Route changed with active UI elements, cleaning up");
        resetAllUI();
      }
      
      // Also check for any stray blocking elements
      setTimeout(() => {
        if (detectBlockingUI()) {
          console.log("Detected blocking UI after navigation, showing emergency button");
          setIsEmergencyVisible(true);
        }
      }, 500);
    };
    
    // Use popstate event to detect navigation
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [activeUIElements.length]);
  
  // Handle React Portal cleanup for dialogs and modals
  useEffect(() => {
    // Create a mutation observer to watch for added nodes that might be portals
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          // Check if any added node is a portal
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && 
                (node.hasAttribute('data-radix-portal') || 
                 node.getAttribute('role') === 'dialog')) {
              console.log("Detected new portal or dialog:", node);
              
              // When portal is found, make sure emergency button is visible
              setIsEmergencyVisible(true);
            }
          });
        }
      });
    });
    
    // Start observing the document body for portal additions
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      observer.disconnect();
    };
  }, []);

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
      <EmergencyResetButtonWrapper />
    </UIResetContext.Provider>
  );
};

// Separate component to ensure the button is always rendered at the root level
const EmergencyResetButtonWrapper = () => {
  const { resetAllUI, isEmergencyVisible } = useUIReset();
  
  if (!isEmergencyVisible) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-4 right-4 z-[9999] transition-all animate-pulse hover:animate-none drop-shadow-lg"
      onClick={resetAllUI} // Add click handler directly to the wrapper for better reliability
    >
      <button 
        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md flex items-center gap-2 animate-bounce text-sm font-medium shadow-lg"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        Reset UI
      </button>
    </div>
  );
};
