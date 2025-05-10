
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";
import { toast } from "sonner";

// Define a helper type to ensure JSON compatibility
export type JsonCompatibleFrame = ExtractedFrame & {
  [key: string]: string | number | boolean | null | undefined | JsonCompatibleFrame[] | { [key: string]: any };
};

// Extend the Database Project type with our additional fields until Supabase types are regenerated
export type Project = Database["public"]["Tables"]["projects"]["Row"] & {
  video_metadata?: {
    duration?: number;
    original_file_name?: string;
    file_type?: string;
    file_size?: number;
  };
  extracted_frames?: ExtractedFrame[] | null;
  folder_id?: string | null;
  videos?: VideoSummary[] | null;
};

// Type for simplified video info to include in projects
export type VideoSummary = {
  id: string;
  title: string | null;
  source_file_path: string | null;
  display_order: number;
  video_metadata?: {
    duration?: number;
    original_file_name?: string;
  };
};

/**
 * Fetches recent projects for the current user
 * @param limit Number of projects to fetch (default: 3)
 */
export const fetchRecentProjects = async (limit: number = 3): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent projects:', error);
    throw error;
  }

  const projects = await enhanceProjectsWithVideos(data || []);
  return projects;
};

/**
 * Fetches a specific project by ID
 * @param id Project ID
 */
export const fetchProjectById = async (id: string): Promise<Project | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching project with ID ${id}:`, error);
    throw error;
  }

  if (!data) return null;

  // Enhance with videos information
  const projects = await enhanceProjectsWithVideos([data]);
  return projects[0];
};

/**
 * Creates a new project
 * @param projectData Project data
 */
export const createProject = async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> => {
  // Handle extracted_frames casting if present
  const supabaseProjectData = { ...projectData };
  if (supabaseProjectData.extracted_frames) {
    // Fix the type casting issue
    const jsonFrames = supabaseProjectData.extracted_frames as any;
    supabaseProjectData.extracted_frames = jsonFrames;
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(supabaseProjectData)
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    throw error;
  }

  // Cast data to Project with proper handling of JSON fields
  const typedProject: Project = {
    ...data,
    // Cast video_metadata JSON to the correct type if present
    video_metadata: data.video_metadata as Project['video_metadata'],
    // Cast extracted_frames JSON to the correct type if present
    extracted_frames: data.extracted_frames as unknown as ExtractedFrame[] | null
  };
  
  return typedProject;
};

/**
 * Updates an existing project
 * @param id Project ID
 * @param projectData Updated project data
 */
export const updateProject = async (id: string, projectData: Partial<Project>): Promise<void> => {
  // Create a copy of projectData to avoid modifying the original
  const updatedData = { ...projectData };
  
  // If projectData contains extracted_frames, ensure it's cast correctly for Supabase
  if (updatedData.extracted_frames) {
    // Fix the type casting issue
    const jsonFrames = updatedData.extracted_frames as any;
    updatedData.extracted_frames = jsonFrames;
  }
    
  const { error } = await supabase
    .from('projects')
    .update(updatedData)
    .eq('id', id);

  if (error) {
    console.error(`Error updating project with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Helper function to enhance projects with their videos information
 * @param projects Array of projects
 * @returns Enhanced projects with videos info
 */
const enhanceProjectsWithVideos = async (projects: Project[]): Promise<Project[]> => {
  if (!projects.length) return [];

  try {
    // Get all project IDs
    const projectIds = projects.map(project => project.id);

    // Fetch videos for all projects in one query to avoid N+1 problem
    const { data: videoData, error } = await supabase
      .from('project_videos')
      .select('id, title, source_file_path, display_order, video_metadata, project_id')
      .in('project_id', projectIds)
      .order('display_order', { ascending: true });

    if (error) {
      console.error("Error fetching project videos:", error);
      return projects;
    }

    // Group videos by project ID
    const videosByProject: { [key: string]: VideoSummary[] } = {};
    videoData?.forEach(video => {
      if (!videosByProject[video.project_id]) {
        videosByProject[video.project_id] = [];
      }
      videosByProject[video.project_id].push({
        id: video.id,
        title: video.title,
        source_file_path: video.source_file_path,
        display_order: video.display_order,
        video_metadata: video.video_metadata as VideoSummary['video_metadata'],
      });
    });

    // Enhance each project with its videos
    return projects.map(project => {
      // Cast data to Project with proper handling of JSON fields
      const typedProject: Project = {
        ...project,
        // Cast video_metadata JSON to the correct type if present
        video_metadata: project.video_metadata as Project['video_metadata'],
        // Cast extracted_frames JSON to the correct type if present
        extracted_frames: project.extracted_frames as unknown as ExtractedFrame[] | null,
        // Add videos
        videos: videosByProject[project.id] || [],
      };
      return typedProject;
    });
  } catch (e) {
    console.error("Error enhancing projects with videos:", e);
    return projects;
  }
};

/**
 * Deletes all storage items associated with a project
 * @param project Project to delete storage for
 * @returns Promise resolving to true if successful
 */
export const deleteProjectStorage = async (project: Project): Promise<boolean> => {
  try {
    console.log(`Deleting storage for project ${project.id}`);
    
    // Track deletion status for different storage types
    const deletionResults = {
      sourceVideo: false,
      extractedFrames: false,
      projectBucket: false,
      projectVideos: false
    };

    // 1. Delete source video file if it exists (from video_uploads bucket)
    if (project.source_type === 'video' && project.source_file_path) {
      try {
        // Extract just the filename from the path
        const filePath = project.source_file_path.split('/').pop();
        
        if (filePath) {
          console.log(`Deleting source video: ${filePath}`);
          const { error } = await supabase.storage
            .from('video_uploads')
            .remove([filePath]);
            
          if (error) {
            console.warn(`Error deleting source video: ${error.message}`);
          } else {
            deletionResults.sourceVideo = true;
            console.log(`Source video deleted successfully`);
          }
        }
      } catch (e) {
        console.error(`Error processing source video deletion: ${e}`);
      }
    }
    
    // 2. Delete all extracted frames using the project ID as prefix
    // These could be in a project-specific bucket or in slide_stills
    if (project.extracted_frames && project.extracted_frames.length > 0) {
      try {
        // Collect all unique frame paths
        const framePaths = new Set<string>();
        project.extracted_frames.forEach(frame => {
          try {
            // Type assertion to access imageUrl property
            // Extract frames are stored as ExtractedFrame type but come from JSON
            if (typeof frame === 'object' && frame !== null && 'imageUrl' in frame) {
              const imageUrl = (frame as ExtractedFrame).imageUrl;
              
              // Example URL: https://[bucket-url]/storage/v1/object/public/slide_stills/project_123/frame.jpg
              const url = new URL(imageUrl);
              const pathParts = url.pathname.split('/');
              
              // Find the bucket name and everything after it
              const publicIndex = pathParts.findIndex(part => part === "public");
              if (publicIndex >= 0 && publicIndex + 2 < pathParts.length) {
                // Get the part after the bucket name
                const filePath = pathParts.slice(publicIndex + 2).join('/');
                if (filePath) {
                  framePaths.add(filePath);
                }
              }
            }
          } catch (e) {
            console.error(`Error parsing frame URL:`, frame, e);
          }
        });
        
        if (framePaths.size > 0) {
          console.log(`Deleting ${framePaths.size} extracted frame files from slide_stills`);
          const { error } = await supabase.storage
            .from('slide_stills')
            .remove([...framePaths]);
            
          if (error) {
            console.warn(`Error deleting frame files: ${error.message}`);
          } else {
            deletionResults.extractedFrames = true;
            console.log(`Frame files deleted successfully`);
          }
        }
      } catch (e) {
        console.error(`Error processing frame deletion: ${e}`);
      }
    }
    
    // 3. Delete all videos associated with the project
    try {
      // Fetch all videos for this project
      const { data: projectVideos, error: videosError } = await supabase
        .from('project_videos')
        .select('source_file_path')
        .eq('project_id', project.id);
      
      if (videosError) {
        console.warn(`Error fetching project videos: ${videosError.message}`);
      } else if (projectVideos && projectVideos.length > 0) {
        console.log(`Deleting ${projectVideos.length} video files`);
        
        // Delete each video file from storage
        for (const video of projectVideos) {
          if (video.source_file_path) {
            try {
              const { error } = await supabase.storage
                .from('video_uploads')
                .remove([video.source_file_path]);
                
              if (error) {
                console.warn(`Error deleting video file ${video.source_file_path}: ${error.message}`);
              }
            } catch (e) {
              console.error(`Error processing video deletion: ${e}`);
            }
          }
        }
        
        deletionResults.projectVideos = true;
      }
    } catch (e) {
      console.error(`Error processing project videos deletion: ${e}`);
    }
    
    // 4. Check if there's a project-specific bucket and delete everything in it
    try {
      const projectBucketName = `project_${project.id}`;
      
      // List all files in the project bucket
      const { data: files, error: listError } = await supabase.storage
        .from(projectBucketName)
        .list();
      
      if (listError) {
        console.log(`Project bucket ${projectBucketName} may not exist or is not accessible: ${listError.message}`);
      } else if (files && files.length > 0) {
        console.log(`Deleting ${files.length} files from project bucket ${projectBucketName}`);
        
        // Extract all file paths
        const filePaths = files.map(file => file.name);
        
        // Delete all files in the bucket
        const { error: deleteError } = await supabase.storage
          .from(projectBucketName)
          .remove(filePaths);
          
        if (deleteError) {
          console.warn(`Error deleting files from project bucket: ${deleteError.message}`);
        } else {
          deletionResults.projectBucket = true;
          console.log(`Project bucket files deleted successfully`);
        }
      } else {
        console.log(`Project bucket ${projectBucketName} exists but is empty`);
        deletionResults.projectBucket = true;
      }
    } catch (e) {
      console.error(`Error processing project bucket deletion: ${e}`);
    }
    
    // Log overall deletion status
    console.log(`Storage deletion results:`, deletionResults);
    
    return true;
  } catch (error) {
    console.error(`Error deleting project storage: ${error}`);
    return false;
  }
};

/**
 * Deletes a project
 * @param id Project ID
 */
export const deleteProject = async (id: string): Promise<void> => {
  try {
    // First, get the project details to have information about storage items
    const project = await fetchProjectById(id);
    
    if (project) {
      // Delete all associated storage items first
      await deleteProjectStorage(project);
      
      // Then delete the project record from the database
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`Error deleting project with ID ${id}:`, error);
        throw error;
      }
      
      console.log(`Project ${id} and all its storage items have been deleted successfully`);
    } else {
      console.warn(`Project with ID ${id} not found, nothing to delete`);
    }
  } catch (error) {
    console.error(`Error in project deletion process: ${error}`);
    throw error;
  }
};
