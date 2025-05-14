
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
      `}
    </style>
  );
};
