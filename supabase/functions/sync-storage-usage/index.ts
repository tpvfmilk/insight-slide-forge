
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
    
    // Calculate total storage used by the user across all buckets
    const { data: buckets, error: bucketsError } = await supabase
      .from('storage.buckets')
      .select('id');
      
    if (bucketsError) {
      console.error("Error fetching buckets:", bucketsError);
      throw bucketsError;
    }
    
    let totalSize = 0;
    
    // For each bucket, get the total size of files owned by the user
    for (const bucket of buckets || []) {
      const { data: objects, error: objectsError } = await supabase
        .from('storage.objects')
        .select('metadata')
        .eq('owner', userId)
        .eq('bucket_id', bucket.id);
        
      if (objectsError) {
        console.error(`Error fetching objects for bucket ${bucket.id}:`, objectsError);
        continue;
      }
      
      // Sum up the file sizes
      for (const object of objects || []) {
        if (object.metadata && object.metadata.size) {
          totalSize += parseInt(object.metadata.size, 10);
        }
      }
    }
    
    console.log(`Total storage used by user ${userId}: ${totalSize} bytes`);
    
    // Update the user_storage record
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
        previouslyTrackedSize: updatedStorage?.previous_size || 0,
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
