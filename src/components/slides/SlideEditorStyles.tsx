
import React from 'react';

export const SlideEditorStyles: React.FC = () => {
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
