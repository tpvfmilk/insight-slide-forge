
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIKey = Deno.env.get("OPENAI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "Project ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get project details from database
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found", details: projectError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get content based on source type
    let contentForProcessing = "";
    if (project.source_type === 'transcript' && project.transcript) {
      contentForProcessing = project.transcript;
    } else if ((project.source_type === 'video' || project.source_type === 'url') && project.source_url) {
      // For demo purposes, we'll use a placeholder message
      // In a real implementation, we would extract transcript from video or URL
      contentForProcessing = `This is a simulated transcript extracted from ${project.source_type === 'video' ? 'the uploaded video' : 'the URL: ' + project.source_url}. In a production environment, this would contain actual transcribed content from the source material.`;
    } else {
      return new Response(
        JSON.stringify({ error: "Content not available for processing" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process with AI
    const slideDeck = await generateSlidesWithAI(contentForProcessing, project.title);
    
    // Update project with generated slides
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        slides: slideDeck,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update project with slides", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, slides: slideDeck }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in generate-slides function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateSlidesWithAI(content: string, title: string): Promise<Slide[]> {
  if (!openAIKey) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    const prompt = `
    You are a professional presentation creator. Create a well-structured slide deck based on the following content.
    Format the output as a JSON array of slide objects, where each slide has:
    - id (string): a unique identifier like "slide-1"
    - title (string): a concise, informative title
    - content (string): bullet points separated by '\\n• ' (newline and bullet)
    - timestamp (optional string): if applicable, in format "00:05:32"
    
    For the main title slide, use the title: "${title}"
    
    Here's the content to transform into slides:
    ${content}
    
    Create 5-7 slides total that capture the key points. Structure should follow a logical flow with introduction, main points, and conclusion.
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using the faster model for cost and speed
        messages: [
          {
            role: "system",
            content: "You are a professional presentation creator specialized in creating well-organized slide decks."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("OpenAI API error:", error);
      throw new Error(`OpenAI API error: ${error.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    let slidesContent = data.choices[0].message.content;
    
    // Extract JSON from potential markdown code blocks
    if (slidesContent.includes("```json")) {
      slidesContent = slidesContent.split("```json")[1].split("```")[0].trim();
    } else if (slidesContent.includes("```")) {
      slidesContent = slidesContent.split("```")[1].split("```")[0].trim();
    }

    // Parse JSON safely
    try {
      const slides: Slide[] = JSON.parse(slidesContent);
      return slides;
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      console.log("Raw response:", slidesContent);
      
      // Return a fallback slide deck
      return [
        {
          id: "slide-1",
          title: title || "Introduction",
          content: "• Failed to generate slides\n• Please try again later"
        }
      ];
    }
  } catch (error) {
    console.error("Error generating slides with AI:", error);
    throw new Error(`Failed to generate slides: ${error.message}`);
  }
}
