
import React from 'react';

export const SlideEditorStyles: React.FC = () => {
  return (
    <style>
      {`
        .active-drag {
          cursor: grabbing !important;
          user-select: none;
        }
        
        /* Improve slider scrollability */
        .filmstrip-container {
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          cursor: grab;
        }
        
        .filmstrip-container:active {
          cursor: grabbing;
        }
        
        /* Fix frame scrolling */
        .frame-grid-container {
          overflow-y: auto;
          scrollbar-width: thin;
          padding-bottom: 1rem;
        }
      `}
    </style>
  );
};
