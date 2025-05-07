
import { Clock, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { Skeleton } from "@/components/ui/skeleton";

export const RecentProjects = () => {
  const { projects, loading } = useProjects({ limit: 3 });

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
    <Card className="col-span-2">
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
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10" />
                  <div>
                    <Skeleton className="h-4 w-[200px] mb-2" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="space-y-4">
            {projects.map((project) => (
              <div 
                key={project.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{project.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(project.created_at)} • {project.model_id || 'No model'} • {project.source_type}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-sm flex items-center">
                    <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                    <ExpirationBadge hours={calculateExpiresIn(project.expires_at)} />
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/projects/${project.id}`}>View</Link>
                  </Button>
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
