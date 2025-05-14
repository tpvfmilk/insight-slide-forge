
import React from "react";
import { useParams } from "react-router-dom";
import { SlideEditorProvider } from "./editor/SlideEditorContext";
import { SlideEditorContent } from "./editor/SlideEditor";
import { SlideEditorProps } from "./editor/SlideEditorTypes";

export const SlideEditor: React.FC<SlideEditorProps> = ({ projectId: propProjectId }) => {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const projectId = propProjectId || routeProjectId;

  return (
    <SlideEditorProvider>
      <SlideEditorContent projectId={projectId} />
    </SlideEditorProvider>
  );
};
