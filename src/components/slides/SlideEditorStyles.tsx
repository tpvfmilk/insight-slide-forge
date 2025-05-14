
import React from 'react';

export const SlideEditorStyles: React.FC = () => {
  return (
    <style>
      {`
        /* Improve slider scrollability */
        .filmstrip-container {
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
        }
        
        /* Fix frame scrolling */
        .frame-grid-container {
          overflow-y: auto;
          scrollbar-width: thin;
          padding-bottom: 1rem;
        }

        /* Make currently selected slide more prominent */
        [data-slide-index].border-primary {
          box-shadow: 0 0 0 2px var(--primary);
          position: relative;
          z-index: 10;
        }
      `}
    </style>
  );
};
