
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create video_uploads bucket if it doesn't exist
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
      
    if (bucketsError) {
      throw new Error(`Failed to list buckets: ${bucketsError.message}`);
    }
    
    const videoBucketExists = buckets.some(bucket => bucket.name === 'video_uploads');
    
    if (!videoBucketExists) {
      const { error: createError } = await supabase
        .storage
        .createBucket('video_uploads', {
          public: false,  // Not public by default for security
          fileSizeLimit: 104857600,  // 100MB limit
        });
        
      if (createError) {
        throw new Error(`Failed to create video_uploads bucket: ${createError.message}`);
      }
      
      // Set RLS policies for the bucket to allow authenticated users to upload/download videos
      const { error: policyError } = await supabase.rpc('create_video_storage_policies');
      
      if (policyError) {
        console.warn(`Failed to set policies for video_uploads bucket: ${policyError.message}`);
        console.warn('You may need to manually set the policies in the Supabase dashboard.');
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Storage initialized successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error initializing storage:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
