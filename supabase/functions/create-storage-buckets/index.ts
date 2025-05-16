
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
    console.log("Creating required storage buckets");

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Define the buckets we need for the application
    const requiredBuckets = [
      {
        id: 'video_uploads',
        name: 'Video Uploads',
        public: true,
        fileSizeLimit: 104857600, // 100MB
      },
      {
        id: 'chunks',
        name: 'Video Chunks',
        public: true,
        fileSizeLimit: 52428800, // 50MB
      },
      {
        id: 'audio_extracts',
        name: 'Audio Extracts',
        public: true,
        fileSizeLimit: 26214400, // 25MB
      },
      {
        id: 'slide_stills',
        name: 'Slide Still Images',
        public: true,
        fileSizeLimit: 10485760, // 10MB
      }
    ];

    const results = [];

    // Create each bucket if it doesn't already exist
    for (const bucket of requiredBuckets) {
      try {
        // Check if bucket exists
        const { data: existingBucket, error: getBucketError } = await supabaseAdmin.storage.getBucket(bucket.id);
        
        if (getBucketError && getBucketError.message.includes('does not exist')) {
          // Create new bucket
          const { data, error } = await supabaseAdmin.storage.createBucket(bucket.id, {
            public: bucket.public,
            fileSizeLimit: bucket.fileSizeLimit,
            allowedMimeTypes: ['video/*', 'audio/*', 'image/*'],
          });

          if (error) {
            results.push({ 
              bucket: bucket.id, 
              status: 'error', 
              message: `Failed to create: ${error.message}`
            });
          } else {
            results.push({ 
              bucket: bucket.id, 
              status: 'created', 
              message: 'Bucket created successfully' 
            });

            // Set up public policies for the bucket if it's public
            if (bucket.public) {
              await createPublicPolicies(supabaseAdmin, bucket.id);
            }
          }
        } else {
          // Update existing bucket
          const { data, error } = await supabaseAdmin.storage.updateBucket(bucket.id, {
            public: bucket.public,
            fileSizeLimit: bucket.fileSizeLimit,
            allowedMimeTypes: ['video/*', 'audio/*', 'image/*'],
          });

          if (error) {
            results.push({ 
              bucket: bucket.id, 
              status: 'error', 
              message: `Failed to update: ${error.message}`
            });
          } else {
            results.push({ 
              bucket: bucket.id, 
              status: 'updated', 
              message: 'Bucket updated successfully' 
            });

            // Update policies for the bucket if it's public
            if (bucket.public) {
              await createPublicPolicies(supabaseAdmin, bucket.id);
            }
          }
        }
      } catch (bucketError) {
        results.push({ 
          bucket: bucket.id, 
          status: 'error', 
          message: bucketError.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: 'Storage buckets initialized successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error in create-storage-buckets function: ${error.message}`);
    console.error(error.stack);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to create public policies for a bucket
async function createPublicPolicies(supabase, bucketId) {
  try {
    // Create policy for public read access
    const { error: readPolicyError } = await supabase.storage.from(bucketId).createPolicy('Public Read Access', {
      name: `${bucketId}_public_read`,
      definition: `bucket_id = '${bucketId}'`,
      type: 'SELECT',
      statements: null
    });

    if (readPolicyError) {
      console.error(`Error creating read policy for ${bucketId}: ${readPolicyError.message}`);
    } else {
      console.log(`Created public read policy for ${bucketId}`);
    }

    // Create policy for authenticated users to upload
    const { error: uploadPolicyError } = await supabase.storage.from(bucketId).createPolicy('Authenticated Upload Access', {
      name: `${bucketId}_auth_insert`,
      definition: `bucket_id = '${bucketId}' AND auth.role() = 'authenticated'`,
      type: 'INSERT',
      statements: null
    });

    if (uploadPolicyError) {
      console.error(`Error creating upload policy for ${bucketId}: ${uploadPolicyError.message}`);
    } else {
      console.log(`Created authenticated upload policy for ${bucketId}`);
    }

    return true;
  } catch (error) {
    console.error(`Error creating policies for ${bucketId}:`, error);
    return false;
  }
}
