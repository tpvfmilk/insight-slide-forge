
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
        public: true,
        file_size_limit: 104857600, // 100MB
      },
      {
        id: 'chunks',
        name: 'Video Chunks',
        public: true,
        file_size_limit: 52428800, // 50MB
      },
      {
        id: 'slide_stills',
        name: 'Slide Stills',
        public: true,
        file_size_limit: 5242880, // 5MB
      },
    ];

    console.log("Starting storage bucket initialization...");
    const results = [];

    for (const bucket of buckets) {
      // Check if bucket exists
      const { data: existingBucket, error: getBucketError } = await supabase
        .storage
        .getBucket(bucket.id);

      if (getBucketError) {
        if (getBucketError.message.includes('not found') || 
            getBucketError.message.includes('Bucket not found')) {
          console.log(`Bucket ${bucket.id} doesn't exist, creating...`);
          // Create bucket if it doesn't exist
          const { data, error: createBucketError } = await supabase
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
        
        // Update bucket settings to ensure they match what we want
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
      }
    }

    // Create RLS policies for the chunks bucket to ensure proper access
    try {
      // IMPORTANT: Ensure the chunks bucket has proper policies for access
      await supabase.rpc('create_storage_policy', { 
        bucket_name: 'chunks',
        policy_name: 'Allow authenticated users to read',
        definition: 'auth.role() = \'authenticated\''
      });
      console.log('Created or updated read policy for chunks bucket');
      
      await supabase.rpc('create_storage_policy', { 
        bucket_name: 'chunks',
        policy_name: 'Allow authenticated users to upload',
        operation: 'INSERT',
        definition: 'auth.role() = \'authenticated\''
      });
      console.log('Created or updated upload policy for chunks bucket');
    } catch (policyError) {
      console.log('Note: Policy creation attempted but may have failed (this is normal if policies already exist)');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Storage initialization completed", 
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in init-storage-buckets function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
