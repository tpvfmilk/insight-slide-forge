
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
    
    // First, get the storage breakdown
    const breakdownResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-storage-breakdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ userId })
    });
    
    if (!breakdownResponse.ok) {
      const errorData = await breakdownResponse.json();
      throw new Error(`Failed to get storage breakdown: ${errorData.error || 'Unknown error'}`);
    }
    
    const breakdownData = await breakdownResponse.json();
    const breakdown = breakdownData.breakdown;
    
    if (!breakdown) {
      throw new Error('No breakdown data returned');
    }
    
    console.log(`Total storage used by user ${userId}: ${breakdown.total} bytes`);
    
    // Update the user's storage record in the database with both total and breakdown data
    const { data, error } = await supabaseAdmin.rpc(
      'update_user_storage_with_breakdown',
      { 
        user_id_param: userId, 
        new_storage_value: breakdown.total,
        videos_size: breakdown.videos,
        slides_size: breakdown.slides,
        frames_size: breakdown.frames,
        other_size: breakdown.other
      }
    );
    
    // If the RPC function doesn't exist yet, fall back to the original function
    if (error && error.message && error.message.includes('function "update_user_storage_with_breakdown" does not exist')) {
      console.log('Falling back to update_user_storage_with_value function');
      
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin.rpc(
        'update_user_storage_with_value',
        { 
          user_id_param: userId, 
          new_storage_value: breakdown.total 
        }
      );
      
      if (fallbackError) {
        throw new Error(`Error updating storage: ${fallbackError.message}`);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          userId: userId,
          storageUsed: breakdown.total,
          previousStorageSize: fallbackData[0]?.previous_size,
          newStorageSize: fallbackData[0]?.new_size,
          breakdown: breakdown
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (error) {
      throw new Error(`Error updating storage: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        userId: userId,
        storageUsed: breakdown.total,
        previousStorageSize: data[0]?.previous_size,
        newStorageSize: data[0]?.new_size,
        breakdown: breakdown
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
