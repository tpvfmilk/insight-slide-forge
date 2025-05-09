
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Starting storage sync for user ${userId}`);
    
    // First, access storage schema through the rpc function
    const { data: storageObjects, error: objectsError } = await supabase
      .rpc('with_storage_schema')
      .eq('owner', userId)
      .filter('name', 'not.like', '.emptyFolderPlaceholder');
      
    if (objectsError) {
      console.error("Error fetching objects:", objectsError);
      throw objectsError;
    }
    
    let totalSize = 0;
    for (const object of storageObjects || []) {
      if (object.metadata && object.metadata.size) {
        totalSize += parseInt(object.metadata.size, 10);
      }
    }
    
    console.log(`Total storage used by user ${userId}: ${totalSize} bytes`);
    
    // Update the user_storage record using our function
    const { data: updatedStorage, error: updateError } = await supabase
      .rpc('update_user_storage_with_value', { 
        user_id_param: userId,
        new_storage_value: totalSize 
      });
    
    if (updateError) {
      console.error("Error updating user storage:", updateError);
      throw updateError;
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        previouslyTrackedSize: updatedStorage?.[0]?.previous_size || 0,
        actualSize: totalSize
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in sync-storage-usage function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
