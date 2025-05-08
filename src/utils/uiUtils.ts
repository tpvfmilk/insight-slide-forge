
/**
 * Utility functions for UI management
 */

/**
 * Checks if there are any RadixUI elements with open state
 * or elements with high z-index that might be blocking interaction
 */
export const detectBlockingUI = (): boolean => {
  // Check for RadixUI elements with open state
  const openRadixElements = document.querySelectorAll('[data-state="open"]');
  
  // Check for elements with high z-index
  const bodyChildren = document.body.children;
  const highZIndexElements = [];
  
  for (let i = 0; i < bodyChildren.length; i++) {
    const element = bodyChildren[i] as HTMLElement;
    const style = window.getComputedStyle(element);
    const zIndex = parseInt(style.zIndex || '0');
    
    if (zIndex > 50 && style.position === 'fixed' && style.display !== 'none') {
      highZIndexElements.push(element);
    }
  }

  // Check specifically for modal backdrops and context menus
  const modalBackdrops = document.querySelectorAll('.bg-black/80, [aria-hidden="true"]');
  const contextMenus = document.querySelectorAll('[role="menu"]');
  
  return openRadixElements.length > 0 || 
         highZIndexElements.length > 0 || 
         modalBackdrops.length > 0 || 
         contextMenus.length > 0;
};

/**
 * Force removes any potential UI blockers from the DOM
 */
export const forceRemoveUIBlockers = (): void => {
  console.log("Removing UI blockers...");
  
  // Set all open dialogs and sheets to closed state
  const openElements = document.querySelectorAll('[data-state="open"]');
  openElements.forEach(element => {
    try {
      element.setAttribute('data-state', 'closed');
      console.log("Set element to closed state:", element);
    } catch (err) {
      console.error("Error setting element state:", err);
    }
  });
  
  // Find and remove modal overlays
  const modalOverlays = document.querySelectorAll('.bg-black/80, [role="dialog"]');
  modalOverlays.forEach(overlay => {
    try {
      if (overlay.parentNode) {
        // For RadixUI components, first try closing them gracefully
        overlay.setAttribute('data-state', 'closed');
        
        // Then after a short delay remove them if they're still in the DOM
        setTimeout(() => {
          if (document.body.contains(overlay) && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
            console.log("Removed overlay:", overlay);
          }
        }, 100);
      }
    } catch (err) {
      console.error("Error removing overlay:", err);
    }
  });

  // Remove any open context menus
  const contextMenus = document.querySelectorAll('[role="menu"]');
  contextMenus.forEach(menu => {
    try {
      if (menu.parentNode) {
        menu.setAttribute('data-state', 'closed');
        
        setTimeout(() => {
          if (document.body.contains(menu) && menu.parentNode) {
            menu.parentNode.removeChild(menu);
            console.log("Removed context menu:", menu);
          }
        }, 100);
      }
    } catch (err) {
      console.error("Error removing context menu:", err);
    }
  });
  
  // Make sure body is scrollable again
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.style.pointerEvents = '';
  
  // Remove any inline styles that might be blocking clicks
  document.querySelectorAll('[style*="pointer-events: none"]').forEach(el => {
    (el as HTMLElement).style.pointerEvents = 'auto';
  });
};
