
import { InsightLayout } from "@/components/layout/InsightLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Download, FileText, Search, Trash } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchRecentProjects, Project, deleteProject } from "@/services/projectService";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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

const ProjectsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  
  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              Manage your generated slide decks
            </p>
          </div>
          <div className="w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full md:w-64"
              />
            </div>
          </div>
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-4 font-medium">Title</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Created</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Model</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">Type</th>
                <th className="text-left p-4 font-medium">Expires</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Loading state
                [1, 2, 3, 4].map(i => (
                  <tr key={i} className="border-t">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <Skeleton className="h-4 w-[100px]" />
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <Skeleton className="h-4 w-[80px]" />
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <Skeleton className="h-4 w-[60px]" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-4 w-[100px]" />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <tr key={project.id} className="border-t hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{project.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">
                      {formatDate(project.created_at)}
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">
                      {project.model_id || 'Not specified'}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">
                      {project.source_type}
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
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <div className="text-muted-foreground">No projects found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </InsightLayout>
  );
};

interface ExpirationBadgeProps {
  hours: number;
}

const ExpirationBadge = ({ hours }: ExpirationBadgeProps) => {
  let color = "";
  let text = "";
  
  if (hours <= 6) {
    color = "text-red-500";
    text = `${hours}h remaining`;
  } else if (hours <= 24) {
    color = "text-amber-500";
    text = `${hours}h remaining`;
  } else {
    color = "text-green-500";
    text = `${hours}h remaining`;
  }
  
  return (
    <div className="flex items-center">
      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
      <span className={color}>{text}</span>
    </div>
  );
};

export default ProjectsPage;
