
import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ProjectVideo, deleteProjectVideo, fetchProjectVideos, updateVideosOrder } from "@/services/projectVideoService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Project } from "@/services/projectService";
import { Plus, Trash2, GripVertical, Edit, Clock, Video } from "lucide-react";
import { VideoUploader } from "@/components/project/VideoUploader";

interface VideoManagementProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onVideoAdded?: () => void;
}

export const VideoManagement = ({
  project,
  isOpen,
  onClose,
  onVideoAdded
}: VideoManagementProps) => {
  const [videos, setVideos] = useState<ProjectVideo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddingVideo, setIsAddingVideo] = useState<boolean>(false);
  const [editingVideo, setEditingVideo] = useState<ProjectVideo | null>(null);

  useEffect(() => {
    if (isOpen && project?.id) {
      console.log("VideoManagement opened - Loading videos for project:", project.id);
      loadProjectVideos();
    }
  }, [isOpen, project]);

  const loadProjectVideos = async () => {
    if (!project?.id) return;
    
    try {
      setLoading(true);
      console.log("Fetching videos for project:", project.id);
      
      const projectVideos = await fetchProjectVideos(project.id);
      console.log("Fetched videos:", projectVideos);
      
      setVideos(projectVideos);
      
      // Log the project.videos property to see if it exists and has data
      if (project.videos) {
        console.log("Project videos from project object:", project.videos);
      } else {
        console.log("Project doesn't have videos property or it's empty");
      }
    } catch (error) {
      console.error("Error loading project videos:", error);
      toast.error("Failed to load project videos");
    } finally {
      setLoading(false);
    }
  };

  const handleOnDragEnd = async (result: any) => {
    if (!result.destination) return;
    
    if (result.destination.index === result.source.index) return;
    
    const items = Array.from(videos);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update the display_order in each item
    const updatedItems = items.map((item, index) => ({
      ...item,
      display_order: index
    }));
    
    setVideos(updatedItems);
    
    try {
      // Send the update to the server
      await updateVideosOrder(updatedItems.map(video => ({
        id: video.id,
        display_order: video.display_order
      })));
      
      toast.success("Video order updated");
    } catch (error) {
      console.error("Error updating video order:", error);
      toast.error("Failed to update video order");
      loadProjectVideos(); // Reload to get current order
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) {
      return;
    }
    
    try {
      await deleteProjectVideo(videoId);
      toast.success("Video deleted");
      loadProjectVideos();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video");
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Unknown";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleVideoAdded = () => {
    setIsAddingVideo(false);
    console.log("Video added, reloading videos list");
    loadProjectVideos();
    if (onVideoAdded) {
      console.log("Calling parent onVideoAdded callback");
      onVideoAdded();
    }
  };

  const handleEditSave = async (video: ProjectVideo) => {
    try {
      await updateVideosOrder([{
        id: video.id,
        display_order: video.display_order
      }]);
      setEditingVideo(null);
      loadProjectVideos();
      toast.success("Video details updated");
    } catch (error) {
      console.error("Error updating video:", error);
      toast.error("Failed to update video details");
    }
  };

  // Function to get the file size in a readable format
  const getFileSize = (bytes?: number): string => {
    if (!bytes) return "Unknown";
    
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }
    
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Manage Project Videos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Button onClick={() => setIsAddingVideo(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Video
          </Button>

          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center p-8 border rounded-lg">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No videos have been added to this project yet</p>
              <Button className="mt-4" onClick={() => setIsAddingVideo(true)}>
                Add First Video
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-medium">Video order ({videos.length})</p>
                <p className="text-sm text-muted-foreground">Drag to reorder</p>
              </div>
              <DragDropContext onDragEnd={handleOnDragEnd}>
                <Droppable droppableId="videos">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 max-h-[400px] overflow-y-auto"
                    >
                      {videos.map((video, index) => (
                        <Draggable
                          key={video.id}
                          draggableId={video.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={{
                                ...provided.draggableProps.style,
                                // Fixed styles for consistent dragging experience
                                transform: snapshot.isDragging ? provided.draggableProps.style?.transform : "none"
                              }}
                              className={`flex items-center p-3 border rounded-lg bg-background transition-shadow ${
                                snapshot.isDragging ? "shadow-md border-primary/50" : ""
                              }`}
                            >
                              {/* Drag handle with proper styling */}
                              <div
                                {...provided.dragHandleProps}
                                className="flex items-center justify-center w-10 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                              </div>
                              
                              <div className="flex-1 min-w-0 pl-2">
                                <div className="flex flex-col">
                                  <h3 className="font-medium truncate">
                                    {video.title || video.video_metadata?.original_file_name || "Untitled Video"}
                                  </h3>
                                  <div className="flex gap-2 text-xs text-muted-foreground">
                                    <span>
                                      {video.video_metadata?.duration ? 
                                        formatDuration(video.video_metadata.duration) : ""}
                                    </span>
                                    {video.video_metadata?.file_size && (
                                      <>
                                        <span>•</span>
                                        <span>{getFileSize(video.video_metadata.file_size)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                className="ml-2"
                                onClick={() => handleDeleteVideo(video.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}
        </div>
      </DialogContent>
      
      {/* Add Video Dialog */}
      <Dialog open={isAddingVideo} onOpenChange={(open) => !open && setIsAddingVideo(false)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Video to Project</DialogTitle>
          </DialogHeader>
          
          {project && (
            <VideoUploader
              project={project}
              onComplete={handleVideoAdded}
              onCancel={() => setIsAddingVideo(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Edit Video Dialog */}
      {editingVideo && (
        <Dialog open={!!editingVideo} onOpenChange={() => setEditingVideo(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Video Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Title
                </label>
                <Input
                  id="title"
                  value={editingVideo.title || ""}
                  onChange={(e) => setEditingVideo({...editingVideo, title: e.target.value})}
                  placeholder="Enter a title for this video"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="description"
                  value={editingVideo.description || ""}
                  onChange={(e) => setEditingVideo({...editingVideo, description: e.target.value})}
                  placeholder="Enter a description for this video"
                  rows={3}
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingVideo(null)}>
                  Cancel
                </Button>
                <Button onClick={() => handleEditSave(editingVideo)}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};
