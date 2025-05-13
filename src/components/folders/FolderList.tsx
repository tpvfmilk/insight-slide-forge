
import { useState, useEffect } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Folder } from "@/services/folderService";
import { Project } from "@/services/projectService";
import { ProjectRow } from "@/components/projects/ProjectRow";
import { Folder as FolderIcon, MoreVertical, Trash } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

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

// Key for localStorage
const EXPANDED_FOLDERS_KEY = "expanded_folders";

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
  // Initialize state from localStorage if available
  const [expandedFolders, setExpandedFolders] = useState<string[]>(() => {
    try {
      // Get user ID to create a user-specific storage key
      const session = supabase.auth.getSession();
      const userSession = supabase.auth.getSession();
      
      // Asynchronously check for user info and update storage key later
      userSession.then(({ data }) => {
        if (data.session?.user?.id) {
          const userId = data.session.user.id;
          const userSpecificKey = `${EXPANDED_FOLDERS_KEY}_${userId}`;
          
          // Load from user-specific key
          const savedExpandedFolders = localStorage.getItem(userSpecificKey);
          if (savedExpandedFolders) {
            const parsed = JSON.parse(savedExpandedFolders);
            // Always include "unassigned" in the parsed result
            const newState = Array.isArray(parsed) ? 
              parsed.includes("unassigned") ? parsed : [...parsed, "unassigned"] : 
              ["unassigned"];
            setExpandedFolders(newState);
          }
        }
      });
      
      // Default state until we can load the user-specific one
      const savedExpandedFolders = localStorage.getItem(EXPANDED_FOLDERS_KEY);
      if (savedExpandedFolders) {
        const parsed = JSON.parse(savedExpandedFolders);
        // Always include "unassigned" in the parsed result
        return Array.isArray(parsed) ? 
          parsed.includes("unassigned") ? parsed : [...parsed, "unassigned"] : 
          ["unassigned"];
      }
      return ["unassigned"];
    } catch (error) {
      console.error("Error loading folder state from localStorage:", error);
      return ["unassigned"];
    }
  });

  // Get user ID for storage
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get user ID on component mount
  useEffect(() => {
    const getUserId = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        setUserId(data.session.user.id);
      }
    };
    
    getUserId();
  }, []);

  // Save expanded folders state to localStorage whenever it changes
  useEffect(() => {
    try {
      // Use user-specific key if available
      const storageKey = userId ? `${EXPANDED_FOLDERS_KEY}_${userId}` : EXPANDED_FOLDERS_KEY;
      localStorage.setItem(storageKey, JSON.stringify(expandedFolders));
    } catch (error) {
      console.error("Error saving folder state to localStorage:", error);
    }
  }, [expandedFolders, userId]);

  // Ensure "unassigned" is always in the expanded folders list
  useEffect(() => {
    if (!expandedFolders.includes("unassigned")) {
      setExpandedFolders(prev => [...prev, "unassigned"]);
    }
  }, [expandedFolders]);

  // Group projects by folder
  const projectsByFolder = projects.reduce((acc: Record<string, Project[]>, project) => {
    const folderId = project.folder_id || "unassigned";
    if (!acc[folderId]) {
      acc[folderId] = [];
    }
    acc[folderId].push(project);
    return acc;
  }, {});

  // Handle expanding/collapsing all folders (except "unassigned" which should always stay expanded)
  const toggleAllFolders = () => {
    if (expandedFolders.length === folders.length + 1) {
      // +1 for "unassigned"
      // Keep only "unassigned" expanded
      setExpandedFolders(["unassigned"]);
    } else {
      // Expand all folders including "unassigned"
      setExpandedFolders([...folders.map(folder => folder.id), "unassigned"]);
    }
  };

  // Custom handler for accordion value change to ensure unassigned stays expanded
  const handleValueChange = (values: string[]) => {
    // Always include "unassigned" in the expanded folders
    if (!values.includes("unassigned")) {
      setExpandedFolders([...values, "unassigned"]);
    } else {
      setExpandedFolders(values);
    }
  };

  return <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={toggleAllFolders}>
          {expandedFolders.length === folders.length + 1 ? "Collapse All" : "Expand All"}
        </Button>
      </div>
    
      <Accordion type="multiple" value={expandedFolders} onValueChange={handleValueChange} className="w-full">
        {/* Render folders */}
        {folders.map(folder => {
        const folderProjects = projectsByFolder[folder.id] || [];
        return <AccordionItem key={folder.id} value={folder.id} className="border rounded-md mb-4">
              <div className="flex items-center justify-between pr-4">
                <AccordionTrigger className="flex-1 hover:no-underline px-4">
                  <div className="flex items-center gap-2 text-left">
                    <FolderIcon className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium px-[10px]">{folder.name}</div>
                      <div className="text-xs text-muted-foreground px-[15px]">{folderProjects.length} projects</div>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditFolder(folder)}>
                      <FolderIcon className="h-4 w-4 mr-2" />
                      Edit Folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive" onSelect={e => e.preventDefault()}>
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
                          <AlertDialogAction onClick={() => onDeleteFolder(folder.id)} className="bg-destructive hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <AccordionContent className="overflow-hidden">
                {folderProjects.length > 0 ? <div className="border rounded-md">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 font-medium">Project</th>
                          <th className="text-left p-4 font-medium">Created</th>
                          <th className="text-left p-4 font-medium hidden lg:table-cell">Duration</th>
                          <th className="text-left p-4 font-medium">File Size</th>
                          <th className="text-right p-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {folderProjects.map(project => <ProjectRow key={project.id} project={project} handleDeleteProject={handleDeleteProject} handleEditTitle={handleEditTitle} handleExport={handleExport} />)}
                      </tbody>
                    </table>
                  </div> : <div className="py-6 text-center text-muted-foreground">
                    No projects in this folder
                  </div>}
              </AccordionContent>
            </AccordionItem>;
      })}
        
        {/* Unfiled Projects - Using Collapsible instead of AccordionItem to make it always open */}
        <div className="border rounded-md mb-4">
          <div className="flex items-center gap-2 px-4 py-4">
            <FolderIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium px-[9px]">Unfiled Projects</div>
            </div>
          </div>
          
          <div className="overflow-hidden">
            {projectsByFolder["unassigned"] && projectsByFolder["unassigned"].length > 0 ? <div className="border rounded-md">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium">Project</th>
                      <th className="text-left p-4 font-medium">Created</th>
                      <th className="text-left p-4 font-medium hidden lg:table-cell">Duration</th>
                      <th className="text-left p-4 font-medium">File Size</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectsByFolder["unassigned"].map(project => <ProjectRow key={project.id} project={project} handleDeleteProject={handleDeleteProject} handleEditTitle={handleEditTitle} handleExport={handleExport} />)}
                  </tbody>
                </table>
              </div> : <div className="py-6 text-center text-muted-foreground">
                No unfiled projects
              </div>}
          </div>
        </div>
      </Accordion>
    </div>;
}
