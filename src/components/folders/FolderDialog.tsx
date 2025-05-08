
import { useState } from "react";
import { toast } from "sonner";
import { DialogTitle, DialogDescription, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Folder, createFolder, updateFolder } from "@/services/folderService";

interface FolderDialogProps {
  folder?: Folder;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FolderDialog({ folder, onSuccess, onCancel }: FolderDialogProps) {
  const [name, setName] = useState(folder?.name || "");
  const [description, setDescription] = useState(folder?.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!folder;
  const title = isEditing ? "Edit Folder" : "Create Folder";
  const buttonText = isEditing ? "Update" : "Create";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Folder name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (isEditing && folder) {
        await updateFolder(folder.id, {
          name,
          description: description || null
        });
        toast.success("Folder updated successfully");
      } else {
        await createFolder({
          name,
          description: description || undefined
        });
        toast.success("Folder created successfully");
      }
      
      onSuccess();
    } catch (error) {
      console.error("Error saving folder:", error);
      toast.error(`Failed to ${isEditing ? "update" : "create"} folder`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the folder details below." 
              : "Create a new folder to organize your projects."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Folder Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter folder name"
              required
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter folder description"
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
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
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? "Saving..." : buttonText}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
