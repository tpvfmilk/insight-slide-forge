
// Edge function to calculate storage breakdown by file type
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StorageBreakdown {
  videos: number;
  slides: number;
  frames: number;
  other: number;
  total: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with admin role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize Supabase client with user token
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Get the user ID from the token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token', details: authError }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Initialize storage breakdown
    const breakdown: StorageBreakdown = {
      videos: 0,
      slides: 0,
      frames: 0,
      other: 0,
      total: 0
    };

    // Get all objects from storage for this user
    const { data: storageObjects, error: storageError } = await supabaseAdmin
      .from('storage.objects')
      .select('name, metadata')
      .eq('owner', userId);
    
    if (storageError) {
      throw new Error(`Error fetching storage objects: ${storageError.message}`);
    }

    // Process each object to categorize by file type
    if (storageObjects) {
      for (const obj of storageObjects) {
        const size = obj.metadata?.size ? parseInt(obj.metadata.size) : 0;
        
        // Skip objects with no size
        if (!size) continue;

        // Add to total size
        breakdown.total += size;
        
        // Categorize by file type based on path or extension
        const name = obj.name.toLowerCase();
        
        if (name.includes('/videos/') || name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov')) {
          breakdown.videos += size;
        } else if (name.includes('/slides/') || name.endsWith('.pdf') || name.endsWith('.pptx')) {
          breakdown.slides += size;
        } else if (name.includes('/frames/') || name.includes('_frame_') || name.endsWith('.jpg') || name.endsWith('.png')) {
          breakdown.frames += size;
        } else {
          breakdown.other += size;
        }
      }
    }

    // Update the user_storage record with the calculated breakdown
    try {
      await supabaseAdmin.rpc('update_user_storage_with_breakdown', {
        user_id_param: userId,
        new_storage_value: breakdown.total,
        videos_size: breakdown.videos,
        slides_size: breakdown.slides,
        frames_size: breakdown.frames,
        other_size: breakdown.other
      });
    } catch (updateError) {
      console.error('Failed to update storage breakdown:', updateError);
      // Continue even if update fails - we can still return the calculated breakdown
    }

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
