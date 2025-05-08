
/**
 * Utility functions for UI management
 */

/**
 * Checks if there are any RadixUI elements with open state
 * or elements with high z-index that might be blocking interaction
 */
export const detectBlockingUI = (): boolean => {
  console.log("Checking for blocking UI elements...");
  
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

  // Check specifically for modal backdrops and context menus using attribute selectors
  // instead of class selectors which can be more reliable
  const modalBackdrops = document.querySelectorAll('[role="dialog"], [data-radix-portal], [aria-hidden="true"]');
  const contextMenus = document.querySelectorAll('[role="menu"]');
  
  // Check for any semi-transparent overlays that might be blocking interaction
  const possibleOverlays = document.querySelectorAll('div[style*="position: fixed"]');
  let hasBlockingOverlay = false;
  
  possibleOverlays.forEach(overlay => {
    const style = window.getComputedStyle(overlay as HTMLElement);
    if (
      style.position === 'fixed' && 
      (style.inset === '0px' || (style.top === '0px' && style.left === '0px' && style.right === '0px' && style.bottom === '0px')) && 
      (style.backgroundColor.includes('rgba') || style.backgroundColor.includes('rgb(0, 0, 0'))
    ) {
      console.log("Found blocking overlay:", overlay);
      hasBlockingOverlay = true;
    }
  });
  
  const isBlocked = openRadixElements.length > 0 || 
         highZIndexElements.length > 0 || 
         modalBackdrops.length > 0 || 
         contextMenus.length > 0 ||
         hasBlockingOverlay;
  
  console.log("UI blocking check result:", {
    openRadixElements: openRadixElements.length,
    highZIndexElements: highZIndexElements.length,
    modalBackdrops: modalBackdrops.length,
    contextMenus: contextMenus.length,
    hasBlockingOverlay
  });
  
  return isBlocked;
};

/**
 * Force removes any potential UI blockers from the DOM
 */
export const forceRemoveUIBlockers = (): void => {
  console.log("Removing UI blockers...");
  
  // First, check if body overflow is disabled and restore it
  if (document.body.style.overflow === 'hidden') {
    console.log("Restoring body overflow");
    document.body.style.overflow = '';
  }
  
  // Set all open dialogs and sheets to closed state
  const openElements = document.querySelectorAll('[data-state="open"]');
  console.log(`Found ${openElements.length} elements with open state`);
  openElements.forEach(element => {
    try {
      element.setAttribute('data-state', 'closed');
      console.log("Set element to closed state:", element);
    } catch (err) {
      console.error("Error setting element state:", err);
    }
  });
  
  // Find and remove modal overlays using more reliable attribute selectors
  const modalOverlays = document.querySelectorAll('[aria-hidden="true"], [data-radix-portal], [role="dialog"]');
  console.log(`Found ${modalOverlays.length} modal overlays`);
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
  console.log(`Found ${contextMenus.length} context menus`);
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
  
  // Find and remove any full-screen semi-transparent overlays that might be blocking interactions
  const allDivs = document.querySelectorAll('div');
  let overlaysRemoved = 0;
  
  allDivs.forEach(div => {
    try {
      const style = window.getComputedStyle(div as HTMLElement);
      
      // Check for fixed position elements that cover the entire screen
      if (
        style.position === 'fixed' && 
        ((style.inset === '0px') || (style.top === '0px' && style.left === '0px' && style.right === '0px' && style.bottom === '0px')) && 
        (
          style.backgroundColor.includes('rgba') || 
          style.backgroundColor.includes('rgb(0, 0, 0') || 
          parseFloat(style.opacity) < 1.0
        )
      ) {
        if (div.parentNode) {
          console.log("Removing potential overlay div:", div);
          div.parentNode.removeChild(div);
          overlaysRemoved++;
        }
      }
    } catch (err) {
      console.error("Error checking div for overlay:", err);
    }
  });
  
  console.log(`Removed ${overlaysRemoved} overlay divs`);

  // Clean up Radix Portal elements that might be left behind
  const portalRoots = document.querySelectorAll('[data-radix-portal]');
  console.log(`Found ${portalRoots.length} RadixUI portals`);
  portalRoots.forEach(portal => {
    try {
      if (portal.parentNode) {
        portal.parentNode.removeChild(portal);
        console.log("Removed RadixUI portal:", portal);
      }
    } catch (err) {
      console.error("Error removing portal:", err);
    }
  });
  
  // Make sure body is scrollable again and any inline styles are removed
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.style.pointerEvents = '';
  
  // Remove any inline styles that might be blocking clicks
  document.querySelectorAll('[style*="pointer-events: none"]').forEach(el => {
    (el as HTMLElement).style.pointerEvents = 'auto';
  });
  
  // Check for any elements with role="presentation" which might be modal overlays
  document.querySelectorAll('[role="presentation"]').forEach(el => {
    if (el.parentNode) {
      console.log("Removing presentation element:", el);
      el.parentNode.removeChild(el);
    }
  });
  
  // Special case for fullscreen dialog backdrops
  document.querySelectorAll('.fixed.inset-0').forEach(el => {
    if (
      (el as HTMLElement).style.backgroundColor.includes('rgba') || 
      (el as HTMLElement).style.backgroundColor.includes('rgb(0, 0, 0')
    ) {
      console.log("Removing fixed inset-0 backdrop:", el);
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  });
  
  console.log("UI blockers removal complete");
};
