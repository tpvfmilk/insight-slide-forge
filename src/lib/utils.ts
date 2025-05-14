
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utility function to prevent event propagation
 */
export function stopPropagation(e: React.MouseEvent | React.TouchEvent) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
}

/**
 * Utility function to ensure consistent overflow handling
 * This prevents screen widening due to content overflow
 */
export function ensureContainment(element: HTMLElement | null) {
  if (!element) return;
  
  // Ensure the element and all its parents have proper overflow constraints
  let current = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (style.overflowX !== 'hidden' && !current.classList.contains('filmstrip-container')) {
      current.style.overflowX = 'hidden';
    }
    current = current.parentElement;
  }
}
