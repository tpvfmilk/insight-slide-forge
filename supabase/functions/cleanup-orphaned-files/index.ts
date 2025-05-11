
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// Set up CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Create a Supabase client with the Admin key
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get request body if any
    let forceCleanup = false;
    let forceDeleteAll = false;
    try {
      const body = await req.json();
      forceCleanup = !!body.forceCleanup;
      forceDeleteAll = !!body.forceDeleteAll;
    } catch (e) {
      // No body or invalid JSON, continue with default settings
    }
    
    // Get the current user from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Starting cleanup for user: ${user.id}, forceCleanup: ${forceCleanup}, forceDeleteAll: ${forceDeleteAll}`)

    // 1. Get all existing projects for the user
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id, source_file_path')
      .eq('user_id', user.id)

    if (projectsError) {
      throw new Error(`Error fetching projects: ${projectsError.message}`)
    }

    // Extract valid project IDs and file paths
    const validProjectIds = projects?.map(p => p.id) || []
    const validSourcePaths = projects?.map(p => p.source_file_path).filter(Boolean) || []
    
    console.log(`Found ${validProjectIds.length} valid projects`)
    
    // In force delete all mode, we'll delete ALL user files regardless of projects
    const hasNoProjects = validProjectIds.length === 0;
    const shouldForceDelete = forceDeleteAll || (forceCleanup && hasNoProjects);
    
    // Storage buckets to check
    const buckets = ['video_uploads', 'slide_stills']
    
    let deletedFilesCount = 0
    let totalSizeDeleted = 0

    // Clean up files in each bucket
    for (const bucket of buckets) {
      console.log(`Checking bucket: ${bucket}`)
      
      // First, list folders for user
      const { data: userFolders, error: folderListError } = await supabaseAdmin
        .storage
        .from(bucket)
        .list(`${user.id}/`, {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' },
        });
        
      if (folderListError) {
        console.error(`Error listing folders in ${bucket} for user ${user.id}:`, folderListError);
        // Continue with next bucket
        continue;
      }

      if (shouldForceDelete) {
        console.log(`Force deleting all files for user ${user.id} in bucket ${bucket}`);
        
        // For force delete all, we just delete the entire user folder
        const { data: deleteResult, error: deleteError } = await supabaseAdmin
          .storage
          .from(bucket)
          .remove([`${user.id}`]);
          
        if (deleteError) {
          console.error(`Error force deleting user folder in ${bucket}:`, deleteError);
        } else {
          console.log(`Successfully deleted user folder in ${bucket}`);
          deletedFilesCount += deleteResult?.length || 0;
        }
        
        continue;
      }
      
      // Regular cleanup mode - List all files in the bucket
      const { data: allFiles, error: listError } = await supabaseAdmin
        .storage
        .from(bucket)
        .list(undefined, {
          limit: 10000,  // Increased limit to catch more files
        })

      if (listError) {
        console.error(`Error listing files in bucket ${bucket}:`, listError)
        continue
      }

      if (!allFiles || allFiles.length === 0) {
        console.log(`No files found in bucket ${bucket}`)
        continue
      }

      console.log(`Found ${allFiles.length} files in bucket ${bucket}`)

      // Filter files that belong to this user
      const userFiles = allFiles.filter(file => 
        file.name.startsWith(`${user.id}/`) || 
        validProjectIds.some(id => file.name.includes(`project_${id}/`))
      );
      
      console.log(`Found ${userFiles.length} files belonging to user in ${bucket}`);
      
      // Files to delete
      const filesToDelete = [];

      // In regular cleanup mode, decide what to delete
      for (const file of userFiles) {
        if (file.id === null) continue; // Skip if it's a folder
        
        let shouldDelete = false;
        
        if (bucket === 'video_uploads') {
          // Check if the file is a source for any project
          if (!validSourcePaths.includes(file.name)) {
            shouldDelete = true;
          }
        } else if (bucket === 'slide_stills') {
          // Check if associated with any valid project
          let isProjectFile = false;
          for (const projectId of validProjectIds) {
            if (file.name.includes(`project_${projectId}/`)) {
              isProjectFile = true;
              break;
            }
          }
          
          // If it's not associated with any valid project
          if (!isProjectFile) {
            shouldDelete = true;
          }
        }

        if (shouldDelete) {
          filesToDelete.push(file.name);
          // Add file size if available
          if (file.metadata && file.metadata.size) {
            totalSizeDeleted += parseInt(file.metadata.size);
          }
        }
      }

      // Delete the orphaned files
      if (filesToDelete.length > 0) {
        console.log(`Deleting ${filesToDelete.length} files from ${bucket}`);
        
        // Due to potential limits on batch deletions, delete in chunks
        const chunkSize = 100;
        for (let i = 0; i < filesToDelete.length; i += chunkSize) {
          const chunk = filesToDelete.slice(i, i + chunkSize);
          const { error: deleteError } = await supabaseAdmin
            .storage
            .from(bucket)
            .remove(chunk);
            
          if (deleteError) {
            console.error(`Error deleting files from ${bucket}:`, deleteError);
          } else {
            deletedFilesCount += chunk.length;
            console.log(`Successfully deleted chunk of ${chunk.length} files`);
          }
        }
      } else {
        console.log(`No files to delete in ${bucket}`);
      }
    }

    // Always try to clear any empty folders
    try {
      for (const bucket of buckets) {
        const { data: emptyFolderFiles } = await supabaseAdmin
          .storage
          .from(bucket)
          .list(`${user.id}/`, {
            limit: 1000,
          });
        
        if (emptyFolderFiles && emptyFolderFiles.length > 0) {
          const emptyFolderPlaceholders = emptyFolderFiles
            .filter(file => file.name.endsWith('.emptyFolderPlaceholder'))
            .map(file => `${user.id}/${file.name}`);
          
          if (emptyFolderPlaceholders.length > 0) {
            console.log(`Removing ${emptyFolderPlaceholders.length} empty folder placeholders`);
            await supabaseAdmin
              .storage
              .from(bucket)
              .remove(emptyFolderPlaceholders);
          }
        }
      }
    } catch (folderError) {
      console.error("Error cleaning empty folders:", folderError);
      // Non-critical error, continue
    }

    // Sync storage usage to update the database
    try {
      // Use the existing sync storage usage function
      const syncResponse = await supabaseAdmin.functions.invoke('sync-storage-usage', {
        body: { userId: user.id }
      });
      
      if (syncResponse.error || !syncResponse.data?.success) {
        console.warn('Storage sync function call failed:', syncResponse.error || 'Unknown error');
        
        // Fallback: Try to directly update storage usage (in case sync function fails)
        await supabaseAdmin.rpc('update_user_storage_with_value', { 
          user_id_param: user.id,
          new_storage_value: 0 
        });
      }
    } catch (syncError) {
      console.error('Error calling sync storage function:', syncError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup completed. Deleted ${deletedFilesCount} files (${formatBytes(totalSizeDeleted)})`,
        deletedCount: deletedFilesCount,
        sizeDeleted: totalSizeDeleted,
        sizeDeletedFormatted: formatBytes(totalSizeDeleted)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in cleanup-orphaned-files function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to format bytes to human-readable format
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
