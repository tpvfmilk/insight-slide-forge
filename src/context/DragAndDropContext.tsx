
import React, { createContext, useContext, useState, ReactNode } from "react";
import { Project } from "@/services/projectService";
import { Folder } from "@/services/folderService";

interface DragAndDropContextType {
  draggedProject: Project | null;
  setDraggedProject: (project: Project | null) => void;
  isDraggingOver: Record<string, boolean>;
  setIsDraggingOver: (folderId: string, isDragging: boolean) => void;
}

const DragAndDropContext = createContext<DragAndDropContextType | undefined>(undefined);

export function DragAndDropProvider({ children }: { children: ReactNode }) {
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [isDraggingOver, setIsDraggingOverState] = useState<Record<string, boolean>>({});

  const setIsDraggingOver = (folderId: string, isDragging: boolean) => {
    setIsDraggingOverState(prev => ({
      ...prev,
      [folderId]: isDragging
    }));
  };

  return (
    <DragAndDropContext.Provider
      value={{
        draggedProject,
        setDraggedProject,
        isDraggingOver,
        setIsDraggingOver
      }}
    >
      {children}
    </DragAndDropContext.Provider>
  );
}

export const useDragAndDrop = () => {
  const context = useContext(DragAndDropContext);
  if (context === undefined) {
    throw new Error("useDragAndDrop must be used within a DragAndDropProvider");
  }
  return context;
};
