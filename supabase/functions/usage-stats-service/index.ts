
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
    // Extract the action from the request
    const { action, userId, days } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseData;

    // Handle different actions
    switch (action) {
      case 'getTotalStats':
        responseData = await getTotalStats(userId);
        break;
      case 'getDailyUsage':
        responseData = await getDailyUsage(userId, days || 7);
        break;
      case 'resetStats':
        responseData = await resetStats(userId);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in usage-stats-service function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Get total token usage statistics for a user
async function getTotalStats(userId: string) {
  const { data, error } = await supabase.rpc('get_user_token_stats', { 
    uid: userId 
  });

  if (error) {
    console.error("Error fetching total usage stats:", error);
    throw error;
  }

  return data;
}

// Get daily token usage for a specified number of days
async function getDailyUsage(userId: string, days: number) {
  const { data, error } = await supabase.rpc('get_daily_token_usage', { 
    uid: userId, 
    days_to_fetch: days 
  });

  if (error) {
    console.error("Error fetching daily usage:", error);
    throw error;
  }

  return data;
}

// Reset token usage statistics for a user
async function resetStats(userId: string) {
  const { data, error } = await supabase.rpc('reset_user_token_stats', { 
    uid: userId 
  });

  if (error) {
    console.error("Error resetting usage stats:", error);
    throw error;
  }

  return { success: true, message: "Statistics reset successfully" };
}
