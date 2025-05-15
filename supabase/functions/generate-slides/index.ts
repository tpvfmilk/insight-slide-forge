
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
    const { projectId, contextPrompt = '', defaultContextPrompt = '', videoDuration = 0, presentationTitle = 'Presentation' } = await req.json();
    
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
    
    console.log(`Using video duration: ${videoDuration}s`);
    console.log(`Using transcript from project: ${project.transcript.substring(0, 100)}...`);
    
    // Use the provided presentation title or fall back to project title
    const finalPresentationTitle = presentationTitle || project.title || "Presentation";
    console.log(`Using presentation title: ${finalPresentationTitle}`);
    
    // Check if transcript has multiple video sections (using ## markers)
    const hasMultipleVideoSections = /^##\s+.+$/m.test(project.transcript);
    console.log(`Transcript has multiple video sections: ${hasMultipleVideoSections}`);
    
    let slides;
    
    if (hasMultipleVideoSections) {
      // Generate slides per section to avoid OpenAI token limits
      slides = await generateSlidesBySections(
        project.transcript,
        contextPrompt,
        defaultContextPrompt,
        finalPresentationTitle,
        videoDuration
      );
    } else {
      // Use the standard approach for single transcripts
      slides = await generateSlidesFromTranscript(
        project.transcript,
        contextPrompt,
        defaultContextPrompt,
        finalPresentationTitle,
        videoDuration
      );
    }
    
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
  contextPrompt: string = "",
  defaultContextPrompt: string = "",
  presentationTitle: string = "Presentation",
  videoDuration: number = 0
): Promise<any[] | null> {
  try {
    // Use the provided context prompt if available, otherwise use the default
    const systemPrompt = contextPrompt || defaultContextPrompt || `You are an AI assistant that generates presentation slides from a transcript of a video. Your goal is to break the transcript into structured, clear, and accurate slide content for a study or review presentation.`;

    // Prepare the user prompt
    let userPrompt = `Based on this transcript, create a presentation titled "${presentationTitle}":`;
    
    // Add context prompt if provided
    if (contextPrompt && contextPrompt.trim()) {
      userPrompt += `\n\nAdditional context: ${contextPrompt}\n\n`;
    }
    
    // Add video duration if available
    if (videoDuration > 0) {
      const durationInMinutes = Math.round(videoDuration / 60);
      userPrompt += `\n\nThe video is approximately ${durationInMinutes} minutes long. Create an appropriate number of slides based on the content.`;
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
    "content": "- Key point 1\\n- Key point 2\\n- Key point 3",
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
]

Remember to preserve the sequential ordering of the transcript in your slides and include precise timestamps for each slide where available.`;
    
    // Call OpenAI API to generate the slides
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using the mini model to save tokens
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Reduced from 0.5 to make output more deterministic
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
      
      // Ensure each slide has required properties and verify sequential ordering
      slides = slides.map((slide, index) => ({
        id: slide.id || `slide-${index + 1}`,
        title: slide.title || `Slide ${index + 1}`,
        content: slide.content || "",
        timestamp: slide.timestamp || null,
        transcriptTimestamps: Array.isArray(slide.transcriptTimestamps) ? slide.transcriptTimestamps : 
                              (slide.timestamp ? [slide.timestamp] : []),
        sequenceIndex: index // Add sequence index to ensure slides remain in order
      }));

      // Sort slides by sequence index to maintain the order they were generated
      slides.sort((a, b) => a.sequenceIndex - b.sequenceIndex);
      
      // Remove the sequence index property as it's not needed for storage
      slides = slides.map(({ sequenceIndex, ...rest }) => rest);
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

/**
 * Generate slides by processing transcript sections separately and combining the results
 */
async function generateSlidesBySections(
  transcript: string,
  contextPrompt: string = "",
  defaultContextPrompt: string = "",
  presentationTitle: string = "Presentation",
  videoDuration: number = 0
): Promise<any[] | null> {
  try {
    console.log("Using section-based generation to handle large transcript");
    
    // Split transcript into sections based on ## headings
    const sectionRegex = /^(##\s+.+)$([\s\S]*?)(?=##\s+|$)/gm;
    let match;
    const sections = [];
    let slideIdCounter = 1;
    
    // Extract all sections
    while ((match = sectionRegex.exec(transcript)) !== null) {
      const title = match[1].trim().replace(/^##\s+/, '');
      const content = match[2].trim();
      sections.push({ title, content });
    }
    
    // If no sections found, treat the entire transcript as one section
    if (sections.length === 0) {
      sections.push({ title: presentationTitle, content: transcript });
    }
    
    console.log(`Found ${sections.length} sections in the transcript`);
    
    let allSlides: any[] = [];
    
    // Process each section separately to avoid token limits
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      console.log(`Processing section ${i + 1} of ${sections.length}: "${section.title}"`);
      
      // Calculate an approximate chunk duration based on the total duration
      let sectionDuration = 0;
      if (sections.length > 0 && videoDuration > 0) {
        sectionDuration = Math.round(videoDuration / sections.length);
      }
      
      // Add a section title slide
      const sectionTitleSlide = {
        id: `slide-${slideIdCounter++}`,
        title: "Video Section",
        content: `# ${section.title}`,
        timestamp: null,
        transcriptTimestamps: [],
        isSection: true
      };
      
      allSlides.push(sectionTitleSlide);
      
      // Generate slides for this section
      const sectionSlides = await generateSlidesFromTranscript(
        section.content,
        contextPrompt,
        defaultContextPrompt,
        section.title,
        sectionDuration
      );
      
      if (sectionSlides) {
        // Update slide IDs to ensure they're unique across all sections
        const processedSlides = sectionSlides.map(slide => ({
          ...slide,
          id: `slide-${slideIdCounter++}`,
          sectionTitle: section.title
        }));
        
        allSlides = [...allSlides, ...processedSlides];
        console.log(`Added ${processedSlides.length} slides from section "${section.title}"`);
      } else {
        console.warn(`Failed to generate slides for section "${section.title}"`);
      }
    }
    
    console.log(`Generated a total of ${allSlides.length} slides from ${sections.length} sections`);
    
    return allSlides;
  } catch (error) {
    console.error("Error in section-based slide generation:", error);
    return null;
  }
}
