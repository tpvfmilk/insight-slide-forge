
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

    console.log(`Starting cleanup for user: ${user.id}`)

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

    // Storage buckets to check
    const buckets = ['video_uploads', 'slide_stills']
    
    let deletedFilesCount = 0
    let totalSizeDeleted = 0

    // Clean up files in each bucket
    for (const bucket of buckets) {
      console.log(`Checking bucket: ${bucket}`)
      
      // List all files in the bucket
      const { data: files, error: listError } = await supabaseAdmin
        .storage
        .from(bucket)
        .list(undefined, {
          limit: 1000,
          offset: 0,
        })

      if (listError) {
        console.error(`Error listing files in bucket ${bucket}:`, listError)
        continue
      }

      if (!files || files.length === 0) {
        console.log(`No files found in bucket ${bucket}`)
        continue
      }

      console.log(`Found ${files.length} files in bucket ${bucket}`)

      // Files to delete
      const filesToDelete = []

      for (const file of files) {
        let shouldDelete = false
        
        // Skip if it's a folder
        if (file.id === null) continue
        
        // Check if file belongs to user by naming convention and if it's orphaned
        if (bucket === 'video_uploads') {
          // Check if the file is a source for any project
          if (file.name.startsWith(`${user.id}/`) && !validSourcePaths.includes(file.name)) {
            shouldDelete = true
          }
        } else if (bucket === 'slide_stills') {
          // Check if associated with any project
          let isProjectFile = false
          for (const projectId of validProjectIds) {
            if (file.name.includes(`project_${projectId}/`)) {
              isProjectFile = true
              break
            }
          }
          
          // If it's user's file but not associated with any valid project
          if (file.name.includes(`/${user.id}/`) && !isProjectFile) {
            shouldDelete = true
          }
        }

        if (shouldDelete) {
          filesToDelete.push(file.name)
          // Add file size if available
          if (file.metadata && file.metadata.size) {
            totalSizeDeleted += parseInt(file.metadata.size)
          }
        }
      }

      // Delete the orphaned files
      if (filesToDelete.length > 0) {
        console.log(`Deleting ${filesToDelete.length} orphaned files from ${bucket}`)
        
        // Due to potential limits on batch deletions, delete in chunks
        const chunkSize = 100
        for (let i = 0; i < filesToDelete.length; i += chunkSize) {
          const chunk = filesToDelete.slice(i, i + chunkSize)
          const { error: deleteError } = await supabaseAdmin
            .storage
            .from(bucket)
            .remove(chunk)
            
          if (deleteError) {
            console.error(`Error deleting files from ${bucket}:`, deleteError)
          } else {
            deletedFilesCount += chunk.length
          }
        }
      } else {
        console.log(`No orphaned files to delete in ${bucket}`)
      }
    }

    // Sync storage usage to update the database
    try {
      // Use the existing sync storage usage function
      const syncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-storage-usage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!syncResponse.ok) {
        console.warn('Storage sync function call failed:', await syncResponse.text())
      }
    } catch (syncError) {
      console.error('Error calling sync storage function:', syncError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup completed. Deleted ${deletedFilesCount} orphaned files (${formatBytes(totalSizeDeleted)})`,
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
