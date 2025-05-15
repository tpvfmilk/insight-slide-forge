
// If this file doesn't exist, create it
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get the user ID from the request body
    let userId;
    try {
      const body = await req.json();
      userId = body.userId;
    } catch (error) {
      // If no body or invalid JSON, try to get the user from auth
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'No authorization header and no userId in body' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', details: authError }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      userId = user.id;
    }
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No user ID provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Starting storage sync for user ${userId}`);
    
    // Create a Supabase client with the admin key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Calculate total storage used by the user
    let totalStorage = 0;
    
    // Storage buckets to check
    const buckets = ['video_uploads', 'slide_stills'];
    
    for (const bucket of buckets) {
      // List files in user's directory
      const { data: files, error: listError } = await supabaseAdmin
        .storage
        .from(bucket)
        .list(undefined, {
          limit: 10000, // Get a large number of files
        });
      
      if (listError) {
        console.error(`Error listing files in bucket ${bucket}:`, listError);
        continue;
      }
      
      if (!files || files.length === 0) {
        console.log(`No files found in bucket ${bucket}`);
        continue;
      }
      
      // Filter files belonging to this user
      const userFiles = files.filter(file => 
        file.name.startsWith(`${userId}/`) || 
        // Projects created by this user
        file.name.includes(`project_`)
      );
      
      for (const file of userFiles) {
        if (file.metadata && file.metadata.size) {
          totalStorage += parseInt(file.metadata.size);
        }
      }
    }
    
    console.log(`Total storage used by user ${userId}: ${totalStorage} bytes`);
    
    // Update the user's storage record in the database
    const { data, error } = await supabaseAdmin.rpc(
      'update_user_storage_with_value',
      { 
        user_id_param: userId, 
        new_storage_value: totalStorage 
      }
    );
    
    if (error) {
      throw new Error(`Error updating storage: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        userId: userId,
        storageUsed: totalStorage,
        previousStorageSize: data[0].previous_size,
        newStorageSize: data[0].new_size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-storage-usage function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
