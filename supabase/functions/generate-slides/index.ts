
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
    // Prepare the system prompt with instructions for professional study slides
    const systemPrompt = `You are an AI assistant that creates professional-quality study slides from a structured video transcript and chapter metadata. The slides are for professionals studying for licensure exams.

# Slide Creation Rules:

1. **Content Slides**:
   - Break the transcript into slides using logical topic breaks or chapter changes
   - Aim for 1–3 slides per minute of video content (target approximately ${targetNumSlides} total slides)
   - Each slide must include:
     - A short, clear **title**
     - 2–5 **bullet points** with concise transcript-based information
     - Placeholder: "[Insert Frame]" (user adds image later)

2. **Question Slides**:
   Detect and handle both styles of questions:

   **A. Multiple Choice Questions (MCQs)**  
   - Slide 1: Present the question clearly with answer choices (A–D format if applicable)
   - Slide 2: "Correct Answer" with:
     - The correct letter (e.g., **Correct Answer: C**)  
     - 1–2 sentence explanation
   - Follow with **Explanation Slides** that elaborate on the concept using transcript content

   **B. Direct-Answer Questions (No A–D choices)**  
   - Slide 1: Present the question text and leave space for the user to consider the answer  
   - Slide 2: "Correct Answer" box with the exact answer provided in the video (verbatim if possible)  
     - Include 1–2 sentence explanation  
   - Follow with **Explanation Slides** from the related portion of the transcript

3. **Explanation Slides**:
   - Only use **verbatim or paraphrased content from the transcript**
   - Break into multiple slides as needed
   - Include "[Insert Frame]" placeholder

4. **Important Guidelines**:
   - Do not add your own knowledge
   - Do not skip explanations
   - Do not fabricate options or answers
   - All content must come directly from the transcript`;

    // Prepare the user prompt
    let userPrompt = `Based on this transcript, create a ${targetNumSlides}-slide presentation titled "${presentationTitle}":`;
    
    // Add context prompt if provided
    if (contextPrompt && contextPrompt.trim()) {
      userPrompt += `\n\nAdditional context: ${contextPrompt}\n\n`;
    }
    
    userPrompt += `\n\nTranscript:\n${transcript}\n\n`;
    
    userPrompt += `
Each slide must be formatted as a JSON object with these fields:
- id: unique identifier (e.g., "slide-1")
- title: clear slide title
- content: bullet points or formatted content
- timestamp: relevant timestamp from transcript if available
- transcriptTimestamps: array of relevant timestamps (optional)

Expected JSON format:
[
  {
    "id": "slide-1",
    "title": "Introduction to the Topic",
    "content": "- Key point 1\\n- Key point 2\\n- Key point 3\\n[Insert Frame]",
    "timestamp": "05:30",
    "transcriptTimestamps": ["05:20", "05:35", "05:50"]
  },
  {
    "id": "slide-2",
    "title": "Sample Question",
    "content": "What is the recommended action in this scenario?\\nA. Option A\\nB. Option B\\nC. Option C\\nD. Option D",
    "timestamp": "06:45",
    "transcriptTimestamps": ["06:45"]
  },
  {
    "id": "slide-3",
    "title": "Correct Answer",
    "content": "✅ **Correct Answer: C**\\n\\nThis is correct because [explanation from transcript].",
    "timestamp": "07:10",
    "transcriptTimestamps": ["07:10"]
  }
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
