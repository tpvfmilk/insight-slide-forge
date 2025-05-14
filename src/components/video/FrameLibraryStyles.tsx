
import React from 'react';

export const FrameLibraryStyles: React.FC = () => {
  return (
    <style>
      {`
        .active-drag {
          cursor: grabbing !important;
          user-select: none;
        }
      `}
    </style>
  );
};
