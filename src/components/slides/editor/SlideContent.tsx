
import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSlideEditor } from "./SlideEditorContext";

export const SlideContent: React.FC = () => {
  const {
    currentSlide,
    editedTitle,
    editedContent,
    isEditing,
    setEditedTitle,
    setEditedContent,
    startEditing,
    saveChanges
  } = useSlideEditor();

  if (!currentSlide) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No slide selected</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {/* Title */}
        <div className="mb-5">
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full text-xl font-semibold border-b border-primary/20 focus:border-primary outline-none pb-2 bg-transparent"
            />
          ) : (
            <h2 
              className="text-xl font-semibold pb-2 border-b border-transparent cursor-pointer hover:border-muted-foreground" 
              onClick={startEditing}
            >
              {currentSlide.title}
            </h2>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto mb-4">
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[250px] h-full resize-none"
            />
          ) : (
            <div 
              className="prose max-w-none cursor-pointer"
              onClick={startEditing}
            >
              {currentSlide.content.split("\n").map((paragraph, i) => (
                <p key={i} className="mb-3">{paragraph}</p>
              ))}
            </div>
          )}
        </div>

        {/* Slide action buttons */}
        {isEditing && (
          <div className="mt-auto pt-4 border-t">
            <Button onClick={saveChanges}>Save Changes</Button>
          </div>
        )}
      </div>
    </div>
  );
};
