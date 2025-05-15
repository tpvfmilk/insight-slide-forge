
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
    // Get the user ID from the request body or auth header
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
    
    console.log(`Calculating storage breakdown for user ${userId}`);
    
    // Create a Supabase client with the admin key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Storage breakdown categories
    const breakdown = {
      videos: 0,
      slides: 0,
      frames: 0,
      other: 0,
      total: 0
    };
    
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
        file.name.includes(`project_`)
      );
      
      for (const file of userFiles) {
        if (file.metadata && file.metadata.size) {
          const size = parseInt(file.metadata.size);
          breakdown.total += size;
          
          // Categorize by file type
          if (bucket === 'video_uploads' || file.name.toLowerCase().match(/\.(mp4|mov|avi|wmv|flv|webm)$/)) {
            breakdown.videos += size;
          } else if (file.name.toLowerCase().includes('frame') || file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
            breakdown.frames += size;
          } else if (file.name.toLowerCase().match(/\.(pdf|ppt|pptx|doc|docx|txt|md)$/)) {
            breakdown.slides += size;
          } else {
            breakdown.other += size;
          }
        }
      }
    }
    
    // Query for slide content data size (from project slides)
    try {
      const { data: projects, error: projectsError } = await supabaseAdmin
        .from('projects')
        .select('id, slides')
        .eq('user_id', userId);
        
      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
      } else if (projects && projects.length > 0) {
        for (const project of projects) {
          if (project.slides) {
            // Estimate size of slides JSON data
            const slidesString = JSON.stringify(project.slides);
            const slideSize = new TextEncoder().encode(slidesString).length;
            breakdown.slides += slideSize;
            breakdown.total += slideSize;
          }
        }
      }
    } catch (error) {
      console.error('Error calculating slides size:', error);
    }
    
    console.log(`Storage breakdown for user ${userId}:`, breakdown);
    
    return new Response(
      JSON.stringify({
        success: true,
        userId: userId,
        breakdown: breakdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-storage-breakdown function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
