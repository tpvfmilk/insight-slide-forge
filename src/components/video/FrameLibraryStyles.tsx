
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
        
        .filmstrip-container .filmstrip-card {
          pointer-events: auto;
        }
        
        .filmstrip-container.active-drag .filmstrip-card {
          pointer-events: none;
        }
      `}
    </style>
  );
};
