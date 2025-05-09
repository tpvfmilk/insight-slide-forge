
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileText, Edit, Download, Trash, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Project } from "@/services/projectService";
import { FileSizeBadge } from "./FileSizeBadge";
import { formatDate } from "@/utils/formatUtils";
import { formatDuration } from "@/utils/formatUtils";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
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
import { Folder as FolderType, fetchFolders, moveProjectsToFolder } from "@/services/folderService";
import { toast } from "sonner";

interface ProjectRowProps {
  project: Project;
  handleDeleteProject: (id: string) => Promise<void>;
  handleEditTitle: (project: Project) => void;
  handleExport: (projectId: string, format: string) => void;
}

export function ProjectRow({
  project,
  handleDeleteProject,
  handleEditTitle,
  handleExport
}: ProjectRowProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [movingToFolder, setMovingToFolder] = useState(false);

  useEffect(() => {
    // Only load folders when the dropdown is opened
    const loadFolders = async () => {
      try {
        setLoadingFolders(true);
        const data = await fetchFolders();
        setFolders(data);
      } catch (error) {
        console.error("Error loading folders:", error);
      } finally {
        setLoadingFolders(false);
      }
    };

    loadFolders();
  }, []);

  const handleMoveToFolder = async (folderId: string | null) => {
    try {
      setMovingToFolder(true);
      await moveProjectsToFolder([project.id], folderId);
      
      // Update the project in the UI
      project.folder_id = folderId;
      
      const folderName = folderId 
        ? folders.find(f => f.id === folderId)?.name 
        : "Unfiled Projects";
      
      toast.success(`Moved "${project.title}" to ${folderName}`);
    } catch (error) {
      console.error("Error moving project to folder:", error);
      toast.error("Failed to move project");
    } finally {
      setMovingToFolder(false);
    }
  };

  return (
    <tr key={project.id} className="border-t hover:bg-muted/30">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="font-medium">
            {project.title}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 ml-2 text-muted-foreground hover:text-foreground" 
              onClick={() => handleEditTitle(project)}
            >
              <Edit className="h-3.5 w-3.5" />
              <span className="sr-only">Edit title</span>
            </Button>
          </div>
        </div>
      </td>
      <td className="p-4 hidden md:table-cell text-muted-foreground">
        {formatDate(project.created_at)}
      </td>
      <td className="p-4 hidden md:table-cell text-muted-foreground">
        {project.video_metadata?.original_file_name || 'N/A'}
      </td>
      <td className="p-4 hidden md:table-cell text-muted-foreground">
        {project.video_metadata?.duration 
          ? formatDuration(project.video_metadata.duration)
          : 'N/A'}
      </td>
      <td className="p-4 hidden lg:table-cell text-muted-foreground">
        {project.slides && Array.isArray(project.slides) 
          ? project.slides.length 
          : 0}
      </td>
      <td className="p-4">
        <FileSizeBadge fileSize={project.video_metadata?.file_size} projectId={project.id} />
      </td>
      <td className="p-4 text-right">
        <div className="flex justify-end items-center gap-2">
          <Button asChild variant="outline" size="icon" className="h-8 w-8">
            <Link to={`/projects/${project.id}`}>
              <FileText className="h-4 w-4" />
              <span className="sr-only">View</span>
            </Link>
          </Button>
          
          {/* Export Dropdown Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Download className="h-4 w-4" />
                <span className="sr-only">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport(project.id, "pdf")}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport(project.id, "pptx")}>
                Export as PowerPoint
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport(project.id, "images")}>
                Export as Images
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Folder Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Folder className="h-4 w-4" />
                <span className="sr-only">Move to Folder</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <div className="flex items-center">
                    <Folder className="h-4 w-4 mr-2" />
                    <span>Move to Folder</span>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup 
                    value={project.folder_id || ""}
                    onValueChange={(value) => {
                      if (!movingToFolder) {
                        handleMoveToFolder(value || null);
                      }
                    }}
                  >
                    <DropdownMenuRadioItem value="">
                      Unfiled Projects
                    </DropdownMenuRadioItem>
                    
                    {loadingFolders ? (
                      <DropdownMenuItem disabled>
                        Loading folders...
                      </DropdownMenuItem>
                    ) : folders.length > 0 ? (
                      folders.map((folder) => (
                        <DropdownMenuRadioItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </DropdownMenuRadioItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        No folders available
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Delete Confirmation Dialog */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{project.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => handleDeleteProject(project.id)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  );
}
