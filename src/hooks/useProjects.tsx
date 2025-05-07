
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Project, fetchRecentProjects } from "@/services/projectService";
import { toast } from "sonner";

interface UseProjectsOptions {
  limit?: number;
}

export const useProjects = ({ limit = 3 }: UseProjectsOptions = {}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadProjects = async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchRecentProjects(limit);
      setProjects(data);
      setError(null);
    } catch (err) {
      console.error("Error loading projects:", err);
      setError(err instanceof Error ? err : new Error("Failed to load projects"));
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user, limit]);

  return {
    projects,
    loading,
    error,
    refresh: loadProjects
  };
};
