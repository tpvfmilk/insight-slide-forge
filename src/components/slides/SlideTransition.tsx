
import React, { useRef, useState, useEffect } from 'react';
import { Slide } from '@/components/slides/editor/SlideEditorTypes';

interface SlideTransitionProps {
  slide: Slide;
  isFullscreen?: boolean;
  transitionDuration?: number; // in milliseconds
  children: React.ReactNode;
}

export const SlideTransition: React.FC<SlideTransitionProps> = ({
  slide,
  isFullscreen,
  transitionDuration = 300,
  children
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [prevSlideId, setPrevSlideId] = useState<string | undefined>(slide?.id);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    // If the slide ID has changed, trigger the transition
    if (prevSlideId !== slide?.id) {
      // Start fade out
      setIsVisible(false);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set timeout to fade in new content
      timeoutRef.current = setTimeout(() => {
        setPrevSlideId(slide?.id);
        setIsVisible(true);
      }, transitionDuration / 2);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [slide?.id, prevSlideId, transitionDuration]);
  
  return (
    <div
      className={`transition-opacity duration-${transitionDuration} w-full h-full`}
      style={{ 
        opacity: isVisible ? 1 : 0,
        transitionDuration: `${transitionDuration}ms`
      }}
    >
      {children}
    </div>
  );
};
