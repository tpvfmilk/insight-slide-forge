
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
