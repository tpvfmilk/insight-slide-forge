
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SlideContentProps {
  currentSlide: {
    title: string;
    content: string;
    timestamp?: string;
  } | undefined;
  editedTitle: string;
  editedContent: string;
  isEditing: boolean;
  startEditing: () => void;
  saveChanges: () => void;
  setEditedTitle: (title: string) => void;
  setEditedContent: (content: string) => void;
}

export const SlideContent = ({
  currentSlide,
  editedTitle,
  editedContent,
  isEditing,
  startEditing,
  saveChanges,
  setEditedTitle,
  setEditedContent
}: SlideContentProps) => {
  if (!currentSlide) return null;
  
  return (
    <div className="w-full lg:w-1/2 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Content</h3>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <Button
              size="sm"
              onClick={saveChanges}
            >
              Save Changes
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startEditing}
            >
              Edit Content
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-4">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">Title</label>
          {isEditing ? (
            <Textarea
              id="title"
              placeholder="Slide title"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              rows={1}
              className="resize-none"
            />
          ) : (
            <div 
              className="min-h-[2.5rem] p-2 border rounded-md bg-muted/20"
              onClick={startEditing}
            >
              {currentSlide.title || "No title"}
            </div>
          )}
        </div>
        
        <div className="space-y-2 flex-1">
          <label htmlFor="content" className="text-sm font-medium">Content</label>
          {isEditing ? (
            <Textarea
              id="content"
              placeholder="Slide content"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="flex-1 h-[calc(100%-2rem)]"
            />
          ) : (
            <div 
              className="min-h-[10rem] h-full p-2 border rounded-md whitespace-pre-wrap bg-muted/20 overflow-y-auto"
              onClick={startEditing}
            >
              {currentSlide.content || "No content"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
