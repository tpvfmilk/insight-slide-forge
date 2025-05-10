
import { useState, useEffect } from "react";
import { ProjectVideo, deleteProjectVideo, fetchProjectVideos, updateVideosOrder } from "@/services/projectVideoService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Project } from "@/services/projectService";
import { Plus, Trash2, GripVertical, Edit, Clock, Video, ArrowUp, ArrowDown } from "lucide-react";
import { VideoUploader } from "@/components/project/VideoUploader";
import { VideoDetailsCard } from "@/components/video/VideoDetailsCard";
import { SafeDialog, SafeDialogContent } from "@/components/ui/safe-dialog";

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
  const [totalDuration, setTotalDuration] = useState<number>(0);

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
      
      // Calculate total duration
      const total = projectVideos.reduce((sum, video) => {
        return sum + (video.video_metadata?.duration || 0);
      }, 0);
      setTotalDuration(total);
      console.log("Total video duration:", total);
      
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

  const moveUp = async (index: number) => {
    if (index <= 0) return; // Can't move the first item up
    
    const items = Array.from(videos);
    const itemToMove = items[index];
    const itemAbove = items[index - 1];
    
    // Swap the display_order values
    const newOrder = itemAbove.display_order;
    const prevOrder = itemToMove.display_order;
    
    // Update the items array
    items[index] = { ...itemToMove, display_order: newOrder };
    items[index - 1] = { ...itemAbove, display_order: prevOrder };
    
    // Sort the array by display_order
    items.sort((a, b) => a.display_order - b.display_order);
    
    setVideos(items);
    
    try {
      // Send the update to the server
      await updateVideosOrder([
        { id: itemToMove.id, display_order: newOrder },
        { id: itemAbove.id, display_order: prevOrder }
      ]);
      
      toast.success("Video order updated");
    } catch (error) {
      console.error("Error updating video order:", error);
      toast.error("Failed to update video order");
      loadProjectVideos(); // Reload to get current order
    }
  };
  
  const moveDown = async (index: number) => {
    if (index >= videos.length - 1) return; // Can't move the last item down
    
    const items = Array.from(videos);
    const itemToMove = items[index];
    const itemBelow = items[index + 1];
    
    // Swap the display_order values
    const newOrder = itemBelow.display_order;
    const prevOrder = itemToMove.display_order;
    
    // Update the items array
    items[index] = { ...itemToMove, display_order: newOrder };
    items[index + 1] = { ...itemBelow, display_order: prevOrder };
    
    // Sort the array by display_order
    items.sort((a, b) => a.display_order - b.display_order);
    
    setVideos(items);
    
    try {
      // Send the update to the server
      await updateVideosOrder([
        { id: itemToMove.id, display_order: newOrder },
        { id: itemBelow.id, display_order: prevOrder }
      ]);
      
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
  
  // Function to format duration in a more readable way
  const formatTotalDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes} min${minutes !== 1 ? 's' : ''} ${secs} sec${secs !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    }
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
    <SafeDialog open={isOpen} onOpenChange={() => onClose()}>
      <SafeDialogContent className="sm:max-w-4xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
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
            <div className="border rounded-lg p-2">
              <div className="flex justify-between items-center mb-2 px-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Video order ({videos.length})</p>
                  {totalDuration > 0 && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      <span>Total: {formatTotalDuration(totalDuration)}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Use arrows to reorder videos</p>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto px-1 py-1">
                {videos.map((video, index) => (
                  <div
                    key={video.id}
                    className="border rounded-md p-2 bg-background"
                  >
                    <div className="flex items-center gap-2">
                      {/* Order number badge */}
                      <div className="flex items-center justify-center bg-muted w-6 h-6 rounded-full text-xs font-medium">
                        {index + 1}
                      </div>
                      
                      {/* Video details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col">
                          <h3 className="font-medium text-sm truncate">
                            {video.title || video.video_metadata?.original_file_name || "Untitled Video"}
                          </h3>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {video.video_metadata?.duration && (
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDuration(video.video_metadata.duration)}
                              </span>
                            )}
                            {video.video_metadata?.file_size && (
                              <span>
                                {getFileSize(video.video_metadata.file_size)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Reordering buttons */}
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveDown(index)}
                          disabled={index === videos.length - 1}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      
                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteVideo(video.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SafeDialogContent>
      
      {/* Add Video Dialog */}
      <SafeDialog open={isAddingVideo} onOpenChange={(open) => !open && setIsAddingVideo(false)}>
        <SafeDialogContent className="sm:max-w-3xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
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
        </SafeDialogContent>
      </SafeDialog>
      
      {/* Edit Video Dialog */}
      {editingVideo && (
        <SafeDialog open={!!editingVideo} onOpenChange={() => setEditingVideo(null)}>
          <SafeDialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
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
          </SafeDialogContent>
        </SafeDialog>
      )}
    </SafeDialog>
  );
};
