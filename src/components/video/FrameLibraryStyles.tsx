
import React from 'react';

export const FrameLibraryStyles: React.FC = () => {
  return (
    <style>
      {`
        /* Core styles for drag scrolling */
        .active-drag {
          cursor: grabbing !important;
          user-select: none !important;
        }
        
        .filmstrip-container {
          cursor: grab;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          position: relative;
          touch-action: pan-x;
        }
        
        /* Ensure elements remain clickable */
        .filmstrip-container .filmstrip-card {
          pointer-events: auto;
          user-select: none;
        }
        
        /* Only disable pointer events on non-interactive elements during drag */
        .filmstrip-container.active-drag .filmstrip-card {
          pointer-events: none;
        }
        .filmstrip-container.active-drag .filmstrip-card button {
          pointer-events: none;
        }
        
        /* Ensure video and canvas can always be interacted with */
        video, canvas {
          pointer-events: auto !important;
        }
        
        /* Additional styles for improved canvas rendering */
        .hidden-canvas {
          position: absolute !important;
          left: -9999px !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        
        /* Hide scrollbars but keep functionality */
        .filmstrip-container::-webkit-scrollbar {
          height: 0;
          width: 0;
          display: none;
        }
        
        /* Firefox scrollbar hiding */
        .filmstrip-container {
          scrollbar-width: none;
        }
      `}
    </style>
  );
};
