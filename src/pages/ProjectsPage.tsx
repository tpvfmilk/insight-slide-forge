import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { InsightLayout } from "@/components/layout/InsightLayout";
import { fetchRecentProjects, Project, deleteProject, updateProject } from "@/services/projectService";
import { toast } from "sonner";
import { SafeDialog, SafeDialogContent } from "@/components/ui/safe-dialog";
import { ProjectsHeader } from "@/components/projects/ProjectsHeader";
import { ProjectTitleEditor } from "@/components/projects/ProjectTitleEditor";
import { Button } from "@/components/ui/button";
import { FolderList } from "@/components/folders/FolderList";
import { FolderDialog } from "@/components/folders/FolderDialog";
import { Folder as FolderIcon, AlertCircle } from "lucide-react";
import { Folder as FolderType, createFolder, deleteFolder, fetchFolders } from "@/services/folderService";
import { syncStorageUsage } from "@/services/storageService";
import { EmptyProjectsMessage } from "@/components/projects/EmptyProjectsMessage";

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      // Get all projects, not just the limited number
      const data = await fetchRecentProjects(100);
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast.error("Failed to load projects");
      setError("Could not load projects. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };
  
  const loadFolders = async () => {
    try {
      setLoadingFolders(true);
      const data = await fetchFolders();
      setFolders(data);
    } catch (error) {
      console.error("Failed to load folders:", error);
      toast.error("Failed to load folders");
      // We don't set the error state here as we can still show projects without folders
    } finally {
      setLoadingFolders(false);
    }
  };
  
  useEffect(() => {
    // Using Promise.allSettled to ensure that even if one promise fails, we still get results from the other
    Promise.allSettled([loadProjects(), loadFolders()])
      .then((results) => {
        // Handle any specific error cases if needed
        if (results[0].status === 'rejected') {
          console.error("Projects loading failed:", results[0].reason);
        }
        if (results[1].status === 'rejected') {
          console.error("Folders loading failed:", results[1].reason);
        }
      });
  }, []);
  
  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      
      // Update the projects list
      setProjects(projects.filter(project => project.id !== projectId));
      
      // Sync storage usage to update metrics after deletion
      await syncStorageUsage();
      
      // Invalidate the storage info query to update the storage usage bar
      queryClient.invalidateQueries({ queryKey: ['storage-info'] });
      
      toast.success("Project deleted successfully");
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
  
  const handleCreateFolder = () => {
    setIsCreateFolderOpen(true);
  };
  
  const handleFolderSaved = () => {
    setIsCreateFolderOpen(false);
    setEditingFolder(null);
    loadFolders();
  };
  
  const handleEditFolder = (folder: FolderType) => {
    setEditingFolder(folder);
  };
  
  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId);
      
      // Update folders list
      setFolders(folders.filter(folder => folder.id !== folderId));
      
      // Update projects list to reflect the folder change
      setProjects(projects.map(project => 
        project.folder_id === folderId ? { ...project, folder_id: null } : project
      ));
      
      toast.success("Folder deleted successfully");
    } catch (error) {
      console.error("Failed to delete folder:", error);
      toast.error("Failed to delete folder");
    }
  };
  
  const handleExport = (projectId: string, format: string) => {
    // This would be implemented in exportService.ts
    toast.success(`Exporting as ${format}...`);
  };
  
  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <InsightLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <ProjectsHeader 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery} 
          />
          
          <Button onClick={handleCreateFolder} className="w-full md:w-auto">
            <FolderIcon className="h-4 w-4 mr-2" />
            Create Folder
          </Button>
        </div>
        
        {loading || loadingFolders ? (
          <div className="border rounded-lg p-8 text-center">
            <div className="text-muted-foreground">Loading projects and folders...</div>
          </div>
        ) : error ? (
          <div className="border border-destructive rounded-lg p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="text-destructive font-medium">{error}</div>
              <Button variant="outline" onClick={() => {
                setLoading(true);
                loadProjects();
              }} className="mt-2">
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <FolderList
            folders={folders}
            projects={filteredProjects}
            onDeleteFolder={handleDeleteFolder}
            onEditFolder={handleEditFolder}
            handleDeleteProject={handleDeleteProject}
            handleEditTitle={handleEditTitle}
            handleExport={handleExport}
            loading={loading}
            error={error}  // Correctly passing the error prop
          />
        )}
      </div>

      {/* Edit Project Title Dialog */}
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
      
      {/* Create Folder Dialog */}
      <SafeDialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <FolderDialog
          onSuccess={handleFolderSaved}
          onCancel={() => setIsCreateFolderOpen(false)}
        />
      </SafeDialog>
      
      {/* Edit Folder Dialog */}
      <SafeDialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        {editingFolder && (
          <FolderDialog
            folder={editingFolder}
            onSuccess={handleFolderSaved}
            onCancel={() => setEditingFolder(null)}
          />
        )}
      </SafeDialog>
    </InsightLayout>
  );
};

export default ProjectsPage;
