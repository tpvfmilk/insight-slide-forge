
import React from 'react';

export const SlideEditorStyles: React.FC = () => {
  return (
    <style>
      {`
        /* Hide scrollbar but maintain functionality */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        
        .hide-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Improve slider scrollability */
        .filmstrip-container {
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          max-width: 100%;
          flex-shrink: 1;
          flex-grow: 1;
          width: 100%;
          overscroll-behavior-x: contain;
          padding-bottom: 0.25rem;
        }
        
        /* Fix frame scrolling */
        .frame-grid-container {
          overflow-y: auto;
          scrollbar-width: thin;
          padding-bottom: 1rem;
        }

        /* Make currently selected slide more prominent */
        [data-slide-index].border-primary {
          box-shadow: 0 0 0 2px hsl(var(--primary));
          position: relative;
          z-index: 10;
          transform: scale(1.02);
          transition: transform 0.2s ease;
        }
        
        /* Ensure modal content can scroll properly */
        .modal-content-scrollable {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
      `}
    </style>
  );
};
