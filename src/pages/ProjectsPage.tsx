
import { InsightLayout } from "@/components/layout/InsightLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Download, FileText, Search, Trash } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

// Sample project data
const projectsData = [
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
  },
  {
    id: "4",
    title: "Statistical Methods in Research",
    created: "2025-05-04T16:15:00Z",
    model: "gpt-3.5-turbo",
    tokens: 5238,
    expiresIn: 1, // hours remaining
  }
];

const ProjectsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredProjects = projectsData.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
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
                <th className="text-left p-4 font-medium hidden lg:table-cell">Tokens</th>
                <th className="text-left p-4 font-medium">Expires</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
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
                      {formatDate(project.created)}
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">
                      {project.model}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">
                      {project.tokens.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <ExpirationBadge hours={project.expiresIn} />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Button asChild variant="outline" size="icon" className="h-8 w-8">
                          <Link to={`/projects/${project.id}`}>
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Link>
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Download</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
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
