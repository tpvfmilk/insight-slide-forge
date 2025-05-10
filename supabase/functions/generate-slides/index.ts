
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAIKey = Deno.env.get("OPENAI_API_KEY");
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, contextPrompt = '', slidesPerMinute = 6, videoDuration = 0, presentationTitle = 'Presentation' } = await req.json();
    
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "Project ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get project details from database
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('transcript, source_type, title, video_metadata')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If no transcript, we can't generate slides
    if (!project.transcript) {
      return new Response(
        JSON.stringify({ error: "Project has no transcript" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate number of slides based on duration or default to a reasonable number
    let targetNumSlides = 10;
    
    if (videoDuration && slidesPerMinute) {
      // Calculate from total video duration and slides per minute
      const durationInMinutes = videoDuration / 60;
      targetNumSlides = Math.max(5, Math.round(durationInMinutes * slidesPerMinute));
      console.log(`Using video duration: ${videoDuration}s (${durationInMinutes.toFixed(2)} min) with ${slidesPerMinute} slides/min = ${targetNumSlides} slides`);
    } else if (project.video_metadata?.duration && slidesPerMinute) {
      // Fallback to main video duration if available
      const duration = project.video_metadata.duration as number;
      const durationInMinutes = duration / 60;
      targetNumSlides = Math.max(5, Math.round(durationInMinutes * slidesPerMinute));
      console.log(`Using project video metadata duration: ${duration}s with ${slidesPerMinute} slides/min = ${targetNumSlides} slides`);
    } else {
      // If no duration, estimate based on transcript length
      // Average read speed is about 150 words per minute, average slide might contain ~30 words
      const wordCount = project.transcript.split(/\s+/).length;
      const estimatedMinutes = wordCount / 150;
      targetNumSlides = Math.max(5, Math.round(estimatedMinutes * slidesPerMinute));
      console.log(`Estimated ${targetNumSlides} slides from transcript word count (${wordCount} words)`);
    }
    
    // Cap the number of slides to a reasonable maximum to avoid token limits
    targetNumSlides = Math.min(targetNumSlides, 30);
    console.log(`Final target slides: ${targetNumSlides}`);
    
    console.log(`Using transcript from project: ${project.transcript.substring(0, 100)}...`);
    
    // Use the provided presentation title or fall back to project title
    const finalPresentationTitle = presentationTitle || project.title || "Presentation";
    console.log(`Using presentation title: ${finalPresentationTitle}`);
    
    // Generate the slides using OpenAI
    const slides = await generateSlidesFromTranscript(
      project.transcript, 
      targetNumSlides, 
      contextPrompt,
      finalPresentationTitle
    );
    
    if (!slides) {
      return new Response(
        JSON.stringify({ error: "Failed to generate slides" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update the project with the generated slides
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        slides,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    if (updateError) {
      console.error("Failed to update project with slides:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update project with slides" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Return the slides
    return new Response(
      JSON.stringify({ slides }),
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

/**
 * Generate slides from transcript using OpenAI
 */
async function generateSlidesFromTranscript(
  transcript: string, 
  targetNumSlides: number,
  contextPrompt: string = "",
  presentationTitle: string = "Presentation"
): Promise<any[] | null> {
  try {
    // Prepare the system prompt with instructions for handling multiple video sections
    const systemPrompt = `You are a professional presentation creator. Create a presentation based on the provided transcript.
    
Key requirements:
1. Create exactly ${targetNumSlides} slides.
2. The transcript may contain multiple video sections marked by "## [Video Title]".
3. Create slides that span the entire content, distributing them proportionally across all video sections.
4. For each slide, extract the most relevant timestamp from the transcript in the format [MM:SS].
5. Each slide must include: id, title (short and concise), content (bullet points), and timestamp if available.
6. Don't focus only on the beginning of the transcript; cover the entire content.
7. If the transcript has sections marked with ##, ensure slides cover content from all sections.

Your output should be valid JSON - an array of slide objects.`;

    // Prepare the user prompt
    let userPrompt = `Based on this transcript, create a ${targetNumSlides}-slide presentation titled "${presentationTitle}":`;
    
    // Add context prompt if provided
    if (contextPrompt && contextPrompt.trim()) {
      userPrompt += `\n\nAdditional context: ${contextPrompt}\n\n`;
    }
    
    userPrompt += `\n\nTranscript:\n${transcript}\n\n`;
    
    userPrompt += `
Remember:
- Create exactly ${targetNumSlides} slides
- Distribute slides evenly across all video sections
- Include relevant timestamps for each slide
- Format as valid JSON array of slide objects

Expected JSON format:
[
  {
    "id": "slide-1",
    "title": "Slide Title",
    "content": "- Bullet point 1\\n- Bullet point 2\\n- Bullet point 3",
    "timestamp": "05:30",
    "transcriptTimestamps": ["05:20", "05:35", "05:50"]
  },
  ...
]`;
    
    // Call OpenAI API to generate the slides
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 3500
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      throw new Error("Failed to generate slides: API error");
    }
    
    const result = await response.json();
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error("Invalid response from OpenAI API");
    }
    
    // Log token usage
    if (result.usage) {
      console.log(`Token usage - Input: ${result.usage.prompt_tokens}, Output: ${result.usage.completion_tokens}, Total: ${result.usage.total_tokens}, Cost: $${(result.usage.total_tokens * 0.0000003).toFixed(4)}`);
    }
    
    const content = result.choices[0].message.content;
    
    // Extract JSON from the response
    let slides;
    
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        slides = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, try parsing the entire response
        slides = JSON.parse(content);
      }
      
      // Validate the slides
      if (!Array.isArray(slides)) {
        throw new Error("Response is not a valid array");
      }
      
      // Ensure each slide has required properties
      slides = slides.map((slide, index) => ({
        id: slide.id || `slide-${index + 1}`,
        title: slide.title || `Slide ${index + 1}`,
        content: slide.content || "",
        timestamp: slide.timestamp || null,
        transcriptTimestamps: Array.isArray(slide.transcriptTimestamps) ? slide.transcriptTimestamps : 
                              (slide.timestamp ? [slide.timestamp] : [])
      }));
    } catch (error) {
      console.error("Failed to parse slides:", error);
      throw new Error("Failed to parse slides from API response");
    }
    
    return slides;
  } catch (error) {
    console.error("Error generating slides:", error);
    return null;
  }
}
