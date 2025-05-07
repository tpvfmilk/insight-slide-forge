
import { InsightLayout } from "@/components/layout/InsightLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

// Sample project data with dates
const projectsByDate = [
  {
    id: "1",
    date: "2025-05-01",
    projects: [
      {
        id: "p1",
        title: "Artificial Intelligence Fundamentals",
        expiresIn: 6, // hours
      }
    ]
  },
  {
    id: "2",
    date: "2025-05-05",
    projects: [
      {
        id: "p2",
        title: "Neuroscience and Consciousness",
        expiresIn: 40, // hours
      }
    ]
  },
  {
    id: "3",
    date: "2025-05-07",
    projects: [
      {
        id: "p3",
        title: "Introduction to Quantum Computing",
        expiresIn: 30, // hours
      },
      {
        id: "p4",
        title: "Advanced Machine Learning Techniques",
        expiresIn: 12, // hours
      }
    ]
  }
];

const CalendarPage = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<string>("month");
  
  // Function to format dates for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Find projects for the selected date
  const selectedDateStr = date ? date.toISOString().split('T')[0] : "";
  const selectedDateProjects = projectsByDate.find(d => d.date === selectedDateStr)?.projects || [];
  
  return (
    <InsightLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Calendar</h1>
            <p className="text-muted-foreground">
              View your projects by date
            </p>
          </div>
          <div className="w-full md:w-auto">
            <Select defaultValue={view} onValueChange={setView}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month View</SelectItem>
                <SelectItem value="week">Week View</SelectItem>
                <SelectItem value="day">Day View</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border rounded-lg p-4 md:col-span-1">
            <div className="mb-4">
              <Label className="text-sm">Select Date</Label>
            </div>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
          </div>
          
          <div className="md:col-span-2 border rounded-lg">
            <div className="border-b p-4">
              <h2 className="text-xl font-semibold">
                {date ? formatDate(date.toISOString()) : "No Date Selected"}
              </h2>
            </div>
            
            <div className="p-4">
              {selectedDateProjects.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-medium">Projects ({selectedDateProjects.length})</h3>
                  {selectedDateProjects.map(project => (
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
                            Expires in {project.expiresIn} hours
                          </div>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/projects/${project.id}`}>View</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  No projects for this date
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </InsightLayout>
  );
};

export default CalendarPage;
