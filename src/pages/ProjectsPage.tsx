
import { useState, useEffect } from "react";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { fetchRecentProjects, Project, deleteProject, updateProject } from "@/services/projectService";
import { toast } from "sonner";
import { SafeDialog, SafeDialogContent } from "@/components/ui/safe-dialog";
import { ProjectsHeader } from "@/components/projects/ProjectsHeader";
import { ProjectsTable } from "@/components/projects/ProjectsTable";
import { ProjectTitleEditor } from "@/components/projects/ProjectTitleEditor";

const ProjectsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  const loadProjects = async () => {
    try {
      setLoading(true);
      // Get all projects, not just the limited number
      const data = await fetchRecentProjects(100);
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadProjects();
  }, []);
  
  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      toast.success("Project deleted successfully");
      
      // Update the projects list
      setProjects(projects.filter(project => project.id !== projectId));
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
    }
  };
  
  const handleEditTitle = (project: Project) => {
    setEditingProject(project);
  };

  const handleTitleSave = async (projectId: string, newTitle: string) => {
    try {
      await updateProject(projectId, { title: newTitle });
      
      // Update the projects list
      setProjects(projects.map(project => 
        project.id === projectId ? { ...project, title: newTitle } : project
      ));
      
      toast.success("Project title updated successfully");
      setEditingProject(null);
    } catch (error) {
      console.error("Failed to update project title:", error);
      toast.error("Failed to update project title");
    }
  };
  
  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Calculate hours remaining until expiration
  const calculateExpiresIn = (expiresAt: string) => {
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diffMs = expiration.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    return Math.max(0, diffHours); // Ensure we don't return negative hours
  };
  
  const handleExport = (projectId: string, format: string) => {
    // This would be implemented in exportService.ts
    toast.success(`Exporting as ${format}...`);
  };
  
  return (
    <InsightLayout>
      <div className="p-6 space-y-6">
        <ProjectsHeader 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
        />
        
        <ProjectsTable
          loading={loading}
          filteredProjects={filteredProjects}
          handleDeleteProject={handleDeleteProject}
          handleEditTitle={handleEditTitle}
          handleExport={handleExport}
          calculateExpiresIn={calculateExpiresIn}
        />
      </div>

      {/* Edit Title Dialog */}
      <SafeDialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <SafeDialogContent className="sm:max-w-md">
          {editingProject && (
            <ProjectTitleEditor
              project={editingProject}
              onSave={handleTitleSave}
              onCancel={() => setEditingProject(null)}
            />
          )}
        </SafeDialogContent>
      </SafeDialog>
    </InsightLayout>
  );
};

export default ProjectsPage;
