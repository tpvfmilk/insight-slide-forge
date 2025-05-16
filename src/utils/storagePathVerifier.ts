
import { supabase } from "@/integrations/supabase/client";
import { verifyStorageBuckets } from "@/services/storageService";
import { parseStoragePath, ensureCorrectChunkPath } from "@/utils/videoPathUtils";

/**
 * Verifies and reports on the status of all storage buckets and paths
 * @returns Promise resolving to a report on storage status
 */
export const verifyStorageStatus = async () => {
  // First verify all required buckets exist
  const bucketStatus = await verifyStorageBuckets();
  
  if (!bucketStatus.success) {
    return {
      success: false,
      message: "Some required storage buckets are missing or inaccessible",
      bucketStatus: bucketStatus.results
    };
  }
  
  // Now check project references to verify paths - limit to recent projects for better performance
  const pathIssues = await checkPathReferences();
  
  return {
    success: pathIssues.length === 0,
    message: pathIssues.length === 0 
      ? "All storage paths are valid" 
      : `Found ${pathIssues.length} issues with storage paths`,
    bucketStatus: bucketStatus.results,
    pathIssues
  };
};

/**
 * Checks project references to storage paths to verify they're correct
 * @returns Promise resolving to array of issues found
 */
const checkPathReferences = async () => {
  const issues = [];
  
  try {
    // Check only the 10 most recent projects for better performance
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, source_type, source_file_path')
      .order('updated_at', { ascending: false })
      .limit(10);
      
    if (projectsError) {
      issues.push({
        type: "database-error",
        message: `Error fetching projects: ${projectsError.message}`
      });
    } else {
      // Check each project's source_file_path
      for (const project of projects || []) {
        if (project.source_type === 'video' && project.source_file_path) {
          try {
            // Parse the path to check bucket
            const { bucketName, filePath } = parseStoragePath(project.source_file_path);
            
            // Just check if bucket exists rather than trying to download the file
            const { data: bucketInfo, error: bucketError } = await supabase.storage
              .getBucket(bucketName);
              
            if (bucketError) {
              issues.push({
                type: "missing-bucket",
                projectId: project.id,
                path: project.source_file_path,
                bucket: bucketName,
                message: `Bucket not found: ${bucketName}`
              });
            }
          } catch (pathError) {
            issues.push({
              type: "path-error",
              projectId: project.id,
              path: project.source_file_path,
              message: `Error parsing path: ${pathError.message}`
            });
          }
        }
      }
    }
    
    // Check a limited number of project videos
    const { data: projectVideos, error: videosError } = await supabase
      .from('project_videos')
      .select('id, project_id, source_file_path')
      .order('updated_at', { ascending: false })
      .limit(10);
      
    if (videosError) {
      issues.push({
        type: "database-error",
        message: `Error fetching project videos: ${videosError.message}`
      });
    } else {
      // Check each video's source_file_path
      for (const video of projectVideos || []) {
        if (video.source_file_path) {
          try {
            // Parse the path to check bucket
            const { bucketName, filePath } = parseStoragePath(video.source_file_path);
            
            // Just check if bucket exists rather than trying to download the file
            const { data: bucketInfo, error: bucketError } = await supabase.storage
              .getBucket(bucketName);
              
            if (bucketError) {
              issues.push({
                type: "missing-bucket",
                projectId: video.project_id,
                videoId: video.id,
                path: video.source_file_path,
                bucket: bucketName,
                message: `Bucket not found: ${bucketName}`
              });
            }
          } catch (pathError) {
            issues.push({
              type: "path-error",
              projectId: video.project_id,
              videoId: video.id,
              path: video.source_file_path,
              message: `Error parsing path: ${pathError.message}`
            });
          }
        }
      }
    }
  } catch (error) {
    issues.push({
      type: "system-error",
      message: `Error checking path references: ${error.message}`
    });
  }
  
  return issues;
};

/**
 * Attempts to fix common path issues in storage references
 * @returns Promise resolving to report on fixes attempted
 */
export const fixCommonStoragePathIssues = async () => {
  const fixes = [];
  
  try {
    // Fix project paths that might be missing correct bucket prefixes
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, source_type, source_file_path')
      .order('updated_at', { ascending: false })
      .limit(20);
      
    if (!projectsError) {
      for (const project of projects || []) {
        if (project.source_type === 'video' && project.source_file_path) {
          const correctedPath = ensureCorrectChunkPath(project.source_file_path);
          
          if (correctedPath && correctedPath !== project.source_file_path) {
            const { error: updateError } = await supabase
              .from('projects')
              .update({ source_file_path: correctedPath })
              .eq('id', project.id);
              
            fixes.push({
              type: "project-path",
              projectId: project.id,
              oldPath: project.source_file_path,
              newPath: correctedPath,
              success: !updateError,
              error: updateError?.message
            });
          }
        }
      }
    }
    
    // Fix project video paths
    const { data: projectVideos, error: videosError } = await supabase
      .from('project_videos')
      .select('id, project_id, source_file_path')
      .order('updated_at', { ascending: false })
      .limit(20);
      
    if (!videosError) {
      for (const video of projectVideos || []) {
        if (video.source_file_path) {
          const correctedPath = ensureCorrectChunkPath(video.source_file_path);
          
          if (correctedPath && correctedPath !== video.source_file_path) {
            const { error: updateError } = await supabase
              .from('project_videos')
              .update({ source_file_path: correctedPath })
              .eq('id', video.id);
              
            fixes.push({
              type: "video-path",
              videoId: video.id,
              projectId: video.project_id,
              oldPath: video.source_file_path,
              newPath: correctedPath,
              success: !updateError,
              error: updateError?.message
            });
          }
        }
      }
    }
  } catch (error) {
    fixes.push({
      type: "system-error",
      success: false,
      message: `Error fixing path issues: ${error.message}`
    });
  }
  
  return {
    success: fixes.every(fix => fix.success !== false),
    fixes
  };
};
