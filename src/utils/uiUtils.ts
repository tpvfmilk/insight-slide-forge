
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
  const overlays = document.querySelectorAll('[role="dialog"], [role="tooltip"], [role="menu"]');
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
  
  // Reset body styles that might have been set by modal libraries
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
};
