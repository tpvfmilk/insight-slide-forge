
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
        id: 'audio_chunks',
        name: 'Audio Chunks',
        public: true,
        fileSizeLimit: 10485760, // 10MB
      },
      {
        id: 'slide_stills',
        name: 'Slide Still Images',
        public: true,
        fileSizeLimit: 10485760, // 10MB
      }
    ];

    const results = [];
    let allSucceeded = true;

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
            console.error(`Failed to create bucket ${bucket.id}:`, error);
            results.push({ 
              bucket: bucket.id, 
              status: 'error', 
              message: `Failed to create: ${error.message}`
            });
            allSucceeded = false;
          } else {
            console.log(`Successfully created bucket: ${bucket.id}`);
            results.push({ 
              bucket: bucket.id, 
              status: 'created', 
              message: 'Bucket created successfully' 
            });
          }
        } else if (getBucketError) {
          console.error(`Error checking if bucket ${bucket.id} exists:`, getBucketError);
          results.push({ 
            bucket: bucket.id, 
            status: 'error', 
            message: `Failed to check bucket: ${getBucketError.message}`
          });
          allSucceeded = false;
        } else {
          // Update existing bucket
          const { data, error } = await supabaseAdmin.storage.updateBucket(bucket.id, {
            public: bucket.public,
            fileSizeLimit: bucket.fileSizeLimit,
            allowedMimeTypes: ['video/*', 'audio/*', 'image/*'],
          });

          if (error) {
            console.error(`Failed to update bucket ${bucket.id}:`, error);
            results.push({ 
              bucket: bucket.id, 
              status: 'error', 
              message: `Failed to update: ${error.message}`
            });
            allSucceeded = false;
          } else {
            console.log(`Successfully updated bucket: ${bucket.id}`);
            results.push({ 
              bucket: bucket.id, 
              status: 'updated', 
              message: 'Bucket updated successfully' 
            });
          }
        }
      } catch (bucketError) {
        console.error(`Unexpected error with bucket ${bucket.id}:`, bucketError);
        results.push({ 
          bucket: bucket.id, 
          status: 'error', 
          message: bucketError.message
        });
        allSucceeded = false;
      }
    }

    // Check if all operations succeeded
    const statusMessage = allSucceeded 
      ? "All storage buckets initialized successfully" 
      : "Some buckets could not be initialized. Check logs for details.";

    // Inform the user which policies must be set up manually
    // We can't use .createPolicy directly as it's not supported in the Supabase JS client
    const policyMessage = `Note: Please ensure RLS policies are set up for these buckets. Go to Storage > Bucket > Policies in the Supabase dashboard to configure:
    - Allow authenticated users to upload files
    - Allow public read access to files`;

    return new Response(
      JSON.stringify({ 
        success: allSucceeded, 
        results,
        message: statusMessage,
        policyNote: policyMessage
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
