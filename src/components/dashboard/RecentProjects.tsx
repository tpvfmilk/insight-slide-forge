
import { Clock, FileText, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/utils/formatUtils";

export const RecentProjects = () => {
  const { projects, loading } = useProjects({ limit: 5 });

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
  
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>
            Your recently generated slide decks
          </CardDescription>
        </div>
        <Button asChild size="sm">
          <Link to="/projects">View All</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          // Loading state
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col p-4 border rounded-lg">
                <Skeleton className="h-5 w-[200px] mb-2" />
                <div className="flex flex-wrap gap-3 mb-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="space-y-4">
            {projects.map((project) => (
              <div 
                key={project.id} 
                className="flex flex-col p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium flex items-center">
                    <div className="p-2 bg-primary/10 rounded mr-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    {project.title}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/projects/${project.id}`}>View</Link>
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-2">
                  <div className="flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    {formatDate(project.created_at)}
                  </div>
                  
                  {project.video_metadata?.original_file_name && (
                    <div className="flex items-center">
                      <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      {project.video_metadata.original_file_name}
                    </div>
                  )}
                  
                  {project.video_metadata?.duration && (
                    <div className="flex items-center">
                      <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      {formatDuration(project.video_metadata.duration)}
                    </div>
                  )}
                </div>
                
                <div className="text-xs flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <ExpirationBadge hours={calculateExpiresIn(project.expires_at)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border rounded-lg">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground">No projects yet</p>
            <Button asChild className="mt-4">
              <Link to="/upload">Create Your First Project</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ExpirationBadgeProps {
  hours: number;
}

const ExpirationBadge = ({ hours }: ExpirationBadgeProps) => {
  let color = "";
  
  if (hours <= 6) {
    color = "text-red-500";
  } else if (hours <= 24) {
    color = "text-amber-500";
  } else {
    color = "text-green-500";
  }
  
  return (
    <span className={color}>
      Expires in {hours}h
    </span>
  );
};
