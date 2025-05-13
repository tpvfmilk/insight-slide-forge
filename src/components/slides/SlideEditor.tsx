
// Re-export from editor folder
import { SlideEditor as EditorComponent } from "./editor/SlideEditor";
import { SlideEditorProvider } from "./editor/SlideEditorContext";

export const SlideEditor = () => {
  return (
    <SlideEditorProvider>
      <EditorComponent />
    </SlideEditorProvider>
  );
};
