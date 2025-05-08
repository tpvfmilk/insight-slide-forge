
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
  
  return openRadixElements.length > 0 || highZIndexElements.length > 0;
};

/**
 * Force removes any potential UI blockers from the DOM
 */
export const forceRemoveUIBlockers = (): void => {
  // Remove any overlay elements that might be stuck
  const overlays = document.querySelectorAll(
    '[role="dialog"], [role="tooltip"], [role="menu"], [data-radix-popper-content-wrapper], .radix-dropdown-menu-content, .radix-context-menu-content, [data-state="open"]'
  );
  
  overlays.forEach(overlay => {
    if (overlay.parentNode) {
      try {
        // First try to set data-state to closed for smooth animation
        overlay.setAttribute('data-state', 'closed');
        
        // After animation time, remove if still in DOM
        setTimeout(() => {
          if (document.body.contains(overlay) && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, 300);
      } catch (error) {
        console.error('Error removing overlay:', error);
      }
    }
  });
  
  // Look for radix portals that might be stuck
  const portals = document.querySelectorAll('[data-radix-portal]');
  portals.forEach(portal => {
    try {
      if (portal.parentNode) {
        portal.parentNode.removeChild(portal);
      }
    } catch (error) {
      console.error('Error removing portal:', error);
    }
  });
  
  // Reset body styles that might have been set by modal libraries
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  
  // Reset any pointerEvents: none that might be blocking interaction
  document.body.style.pointerEvents = '';
  
  // Clear any backdrop/overlay elements
  const backdrops = document.querySelectorAll('.backdrop, .overlay, [class*="overlay"], [class*="backdrop"]');
  backdrops.forEach(backdrop => {
    if (backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
  });
};

/**
 * Special cleanup for frame selector dialog exit
 * Only called when the frame selector dialog is closing
 */
export const cleanupFrameSelectorDialog = (): void => {
  console.log("Cleaning up frame selector dialog...");
  
  // Force any dropdowns to close
  const dropdowns = document.querySelectorAll('[data-radix-dropdown-menu-content], [data-radix-context-menu-content]');
  dropdowns.forEach(dropdown => {
    if (dropdown.parentNode) {
      dropdown.setAttribute('data-state', 'closed');
      setTimeout(() => {
        if (document.body.contains(dropdown) && dropdown.parentNode) {
          dropdown.parentNode.removeChild(dropdown);
        }
      }, 300);
    }
  });
  
  // Ensure any portals created by the frame selector are removed
  const framePortals = document.querySelectorAll('[data-radix-portal]');
  framePortals.forEach(portal => {
    try {
      // Only remove if it seems to be related to dialogs or dropdowns
      const content = portal.querySelector('[role="dialog"], [role="menu"]');
      if (content && portal.parentNode) {
        portal.parentNode.removeChild(portal);
      }
    } catch (error) {
      console.error('Error removing frame selector portal:', error);
    }
  });
  
  // Reset body styles
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.style.pointerEvents = '';
  
  // Re-enable pointer events on main content
  const mainContent = document.querySelector('main');
  if (mainContent instanceof HTMLElement) {
    mainContent.style.pointerEvents = 'auto';
  }
  
  // After a small timeout, verify cleanup was successful
  setTimeout(() => {
    const stillBlocking = detectBlockingUI();
    if (stillBlocking) {
      console.warn("Frame selector cleanup incomplete, forcing stronger cleanup");
      forceRemoveUIBlockers();
    } else {
      console.log("Frame selector cleanup completed successfully");
    }
  }, 500);
};
