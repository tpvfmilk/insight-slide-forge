
import React from "react";
import { Link } from "react-router-dom";
import { FileText, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Project } from "@/services/projectService";
import { FileSizeBadge } from "./FileSizeBadge";
import { formatDate, formatDuration } from "@/utils/formatUtils";
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
import { Folder, fetchFolders, moveProjectsToFolder } from "@/services/folderService";
import { toast } from "sonner";
import { TableRow, TableCell } from "@/components/ui/table";

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
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = React.useState(false);
  const [movingToFolder, setMovingToFolder] = React.useState(false);

  React.useEffect(() => {
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

  // Get the original file name from video metadata
  const originalFileName = project.video_metadata?.original_file_name || "Unknown file";
  
  // Get the duration and format it
  const duration = project.video_metadata?.duration 
    ? formatDuration(project.video_metadata.duration) 
    : "Unknown";

  return (
    <TableRow key={project.id}>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{project.title}</div>
            <div className="text-xs text-muted-foreground">
              {formatDate(project.created_at)}
              <span className="ml-2">• {originalFileName}</span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
        {duration}
      </TableCell>
      <TableCell>
        <FileSizeBadge fileSize={project.video_metadata?.file_size} projectId={project.id} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link to={`/projects/${project.id}`}>
              <FileText className="h-4 w-4 mr-1" />
              <span>View</span>
            </Link>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditTitle(project)}>
                Rename Project
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Move to Folder
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
              
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Export Project
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleExport(project.id, "pdf")}>
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport(project.id, "pptx")}>
                    Export as PowerPoint
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport(project.id, "images")}>
                    Export as Images
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              <DropdownMenuSeparator />
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                    Delete Project
                  </DropdownMenuItem>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
