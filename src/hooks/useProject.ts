
import { useState, useEffect } from "react";
import { Project, fetchProjectById } from "@/services/projectService";

export const useProject = (projectId?: string) => {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const projectData = await fetchProjectById(projectId);
        setProject(projectData);
      } catch (err) {
        console.error("Error loading project:", err);
        setError("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  return { project, isLoading, error };
};
