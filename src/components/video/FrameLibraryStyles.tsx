
import React from 'react';

export const FrameLibraryStyles: React.FC = () => {
  return (
    <style>
      {`
        .active-drag {
          cursor: grabbing !important;
          user-select: none;
        }
        
        .filmstrip-container {
          cursor: grab;
        }
        
        /* Ensure elements remain clickable */
        .filmstrip-container .filmstrip-card {
          pointer-events: auto;
        }
        
        /* Only disable pointer events on non-interactive elements during drag */
        .filmstrip-container.active-drag .filmstrip-card {
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
      `}
    </style>
  );
};
