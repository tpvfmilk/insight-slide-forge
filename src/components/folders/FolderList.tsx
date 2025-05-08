
import { useState } from "react";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Folder } from "@/services/folderService";
import { Project } from "@/services/projectService";
import { ProjectRow } from "@/components/projects/ProjectRow";
import { FolderPen, MoreVertical, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FolderListProps {
  folders: Folder[];
  projects: Project[];
  onDeleteFolder: (id: string) => Promise<void>;
  onEditFolder: (folder: Folder) => void;
  handleDeleteProject: (id: string) => Promise<void>;
  handleEditTitle: (project: Project) => void;
  handleExport: (projectId: string, format: string) => void;
  loading: boolean;
}

export function FolderList({ 
  folders, 
  projects, 
  onDeleteFolder, 
  onEditFolder,
  handleDeleteProject,
  handleEditTitle,
  handleExport,
  loading
}: FolderListProps) {
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  
  // Group projects by folder
  const projectsByFolder = projects.reduce((acc: Record<string, Project[]>, project) => {
    const folderId = project.folder_id || "unassigned";
    if (!acc[folderId]) {
      acc[folderId] = [];
    }
    acc[folderId].push(project);
    return acc;
  }, {});
  
  // Handle expanding/collapsing all folders
  const toggleAllFolders = () => {
    if (expandedFolders.length === folders.length + 1) { // +1 for "unassigned"
      setExpandedFolders([]);
    } else {
      setExpandedFolders([
        ...folders.map(folder => folder.id),
        "unassigned"
      ]);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleAllFolders}
        >
          {expandedFolders.length === folders.length + 1 ? "Collapse All" : "Expand All"}
        </Button>
      </div>
    
      <Accordion
        type="multiple"
        value={expandedFolders}
        onValueChange={setExpandedFolders}
        className="w-full"
      >
        {/* Render folders */}
        {folders.map(folder => {
          const folderProjects = projectsByFolder[folder.id] || [];
          return (
            <AccordionItem key={folder.id} value={folder.id} className="border rounded-md mb-4">
              <div className="flex items-center justify-between pr-4">
                <AccordionTrigger className="flex-1 hover:no-underline px-4">
                  <div className="flex items-center gap-2 text-left">
                    <FolderPen className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{folder.name}</div>
                      <div className="text-xs text-muted-foreground">{folderProjects.length} projects</div>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditFolder(folder)}>
                      <FolderPen className="h-4 w-4 mr-2" />
                      Edit Folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete Folder
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{folder.name}"? Projects in this folder won't be deleted, but they will be moved to Unfiled Projects.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => onDeleteFolder(folder.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <AccordionContent className="overflow-hidden">
                {folderProjects.length > 0 ? (
                  <div className="border rounded-md">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 font-medium">Title</th>
                          <th className="text-left p-4 font-medium hidden md:table-cell">Created</th>
                          <th className="text-left p-4 font-medium hidden md:table-cell">File Name</th>
                          <th className="text-left p-4 font-medium hidden md:table-cell">Duration</th>
                          <th className="text-left p-4 font-medium hidden lg:table-cell">Slides</th>
                          <th className="text-left p-4 font-medium">File Size</th>
                          <th className="text-right p-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {folderProjects.map((project) => (
                          <ProjectRow
                            key={project.id}
                            project={project}
                            handleDeleteProject={handleDeleteProject}
                            handleEditTitle={handleEditTitle}
                            handleExport={handleExport}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-muted-foreground">
                    No projects in this folder
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
        
        {/* Unfiled Projects */}
        <AccordionItem value="unassigned" className="border rounded-md mb-4">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <FolderPen className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Unfiled Projects</div>
                <div className="text-xs text-muted-foreground">
                  {(projectsByFolder["unassigned"] || []).length} projects
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="overflow-hidden">
            {projectsByFolder["unassigned"] && projectsByFolder["unassigned"].length > 0 ? (
              <div className="border rounded-md">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium">Title</th>
                      <th className="text-left p-4 font-medium hidden md:table-cell">Created</th>
                      <th className="text-left p-4 font-medium hidden md:table-cell">File Name</th>
                      <th className="text-left p-4 font-medium hidden md:table-cell">Duration</th>
                      <th className="text-left p-4 font-medium hidden lg:table-cell">Slides</th>
                      <th className="text-left p-4 font-medium">File Size</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectsByFolder["unassigned"].map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        handleDeleteProject={handleDeleteProject}
                        handleEditTitle={handleEditTitle}
                        handleExport={handleExport}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                No unfiled projects
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
