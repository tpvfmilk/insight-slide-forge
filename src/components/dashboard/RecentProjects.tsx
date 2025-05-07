
import { Clock, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

// Sample project data
const projects = [
  {
    id: "1",
    title: "Introduction to Quantum Computing",
    created: "2025-05-07T08:30:00Z",
    model: "gpt-4",
    tokens: 8546,
    expiresIn: 40, // hours remaining
  },
  {
    id: "2",
    title: "Advanced Machine Learning Techniques",
    created: "2025-05-06T14:20:00Z",
    model: "gpt-3.5-turbo",
    tokens: 6238,
    expiresIn: 22, // hours remaining
  },
  {
    id: "3",
    title: "Neuroscience and Consciousness",
    created: "2025-05-05T09:45:00Z",
    model: "gpt-4",
    tokens: 9102,
    expiresIn: 6, // hours remaining
  }
];

export const RecentProjects = () => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
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
                    {formatDate(project.created)} • {project.model} • {project.tokens.toLocaleString()} tokens
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-sm flex items-center">
                  <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                  <ExpirationBadge hours={project.expiresIn} />
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/projects/${project.id}`}>View</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
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
