
import React from "react";
import { Link } from "react-router-dom";
import { FileText, Edit, Download, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Project } from "@/services/projectService";
import { ExpirationBadge } from "./ExpirationBadge";
import { formatDate } from "@/utils/formatUtils";
import { formatDuration } from "@/utils/formatUtils";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
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

interface ProjectRowProps {
  project: Project;
  handleDeleteProject: (id: string) => Promise<void>;
  handleEditTitle: (project: Project) => void;
  handleExport: (projectId: string, format: string) => void;
  calculateExpiresIn: (expiresAt: string) => number;
}

export function ProjectRow({
  project,
  handleDeleteProject,
  handleEditTitle,
  handleExport,
  calculateExpiresIn
}: ProjectRowProps) {
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
        <ExpirationBadge hours={calculateExpiresIn(project.expires_at)} />
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
