
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create buckets if they don't exist
    const buckets = [
      {
        id: 'video_uploads',
        name: 'Video Uploads',
        public: true, // Changed from false to true to ensure bucket is public
        file_size_limit: 104857600, // 100MB
      },
      {
        id: 'slide_stills',
        name: 'Slide Stills',
        public: true,
        file_size_limit: 5242880, // 5MB
      },
    ];

    console.log("Starting storage initialization...");
    const results = [];

    for (const bucket of buckets) {
      // Check if bucket exists
      const { data: existingBucket, error: getBucketError } = await supabase
        .storage
        .getBucket(bucket.id);

      if (getBucketError) {
        if (getBucketError.message === 'The resource was not found') {
          console.log(`Bucket ${bucket.id} doesn't exist, creating...`);
          // Create bucket if it doesn't exist
          const { error: createBucketError } = await supabase
            .storage
            .createBucket(bucket.id, {
              public: bucket.public,
              fileSizeLimit: bucket.file_size_limit,
            });

          if (createBucketError) {
            console.error(`Error creating bucket ${bucket.id}:`, createBucketError);
            results.push({ 
              bucket: bucket.id, 
              status: 'error', 
              message: `Failed to create bucket: ${createBucketError.message}` 
            });
          } else {
            console.log(`Created bucket: ${bucket.id}`);
            results.push({ 
              bucket: bucket.id, 
              status: 'created', 
              message: 'Bucket created successfully' 
            });
          }
        } else {
          console.error(`Error checking bucket ${bucket.id}:`, getBucketError);
          results.push({ 
            bucket: bucket.id, 
            status: 'error', 
            message: `Failed to check bucket: ${getBucketError.message}` 
          });
        }
      } else {
        console.log(`Bucket already exists: ${bucket.id}`);
        
        // Only update bucket settings if they don't match what we want
        // This prevents unnecessarily toggling the public setting
        if (existingBucket.public !== bucket.public || existingBucket.fileSizeLimit !== bucket.file_size_limit) {
          console.log(`Updating bucket ${bucket.id} settings to match desired configuration...`);
          
          const { error: updateError } = await supabase
            .storage
            .updateBucket(bucket.id, {
              public: bucket.public,
              fileSizeLimit: bucket.file_size_limit,
            });
          
          if (updateError) {
            console.error(`Error updating bucket ${bucket.id}:`, updateError);
            results.push({ 
              bucket: bucket.id, 
              status: 'error', 
              message: `Failed to update bucket: ${updateError.message}` 
            });
          } else {
            console.log(`Updated bucket settings: ${bucket.id}`);
            results.push({ 
              bucket: bucket.id, 
              status: 'updated', 
              message: 'Bucket settings updated successfully' 
            });
          }
        } else {
          console.log(`Bucket ${bucket.id} already has the correct settings, skipping update`);
          results.push({ 
            bucket: bucket.id, 
            status: 'unchanged', 
            message: 'Bucket settings already correct' 
          });
        }
      }
    }

    // Check if any bucket setup had errors
    const hasErrors = results.some(result => result.status === 'error');

    return new Response(
      JSON.stringify({ 
        success: !hasErrors, 
        message: "Storage initialization completed", 
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in init-storage function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
