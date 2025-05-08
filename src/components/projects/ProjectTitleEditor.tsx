
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Project } from "@/services/projectService";

interface ProjectTitleEditorProps {
  project: Project;
  onSave: (projectId: string, newTitle: string) => Promise<void>;
  onCancel: () => void;
}

export function ProjectTitleEditor({ project, onSave, onCancel }: ProjectTitleEditorProps) {
  const [title, setTitle] = useState(project.title);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    try {
      setIsSubmitting(true);
      await onSave(project.id, title.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-medium">Edit Project Title</h2>
        <p className="text-sm text-muted-foreground">Update the title for this project</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter project title"
              className="w-full"
              autoComplete="off"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting || !title.trim() || title === project.title}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
