
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define types for project data
interface Project {
  id: string;
  title: string;
  transcript?: string;
  context_prompt?: string;
  [key: string]: any;
}

interface DistillContextType {
  selectedProject: Project | null;
  updateProjectData: (updates: Partial<Project>) => void;
  setSelectedProject: (project: Project | null) => void;
}

// Create the context with default values
const DistillContext = createContext<DistillContextType>({
  selectedProject: null,
  updateProjectData: () => {},
  setSelectedProject: () => {},
});

export function DistillProvider({ children }: { children: ReactNode }) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Function to update project data
  const updateProjectData = (updates: Partial<Project>) => {
    if (!selectedProject) return;

    setSelectedProject({
      ...selectedProject,
      ...updates,
    });

    // Here you would typically also update the project in your database
    // This is a simplified implementation
  };

  return (
    <DistillContext.Provider
      value={{
        selectedProject,
        updateProjectData,
        setSelectedProject,
      }}
    >
      {children}
    </DistillContext.Provider>
  );
}

export function useDistill() {
  return useContext(DistillContext);
}
