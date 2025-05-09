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
  transcriptTimestamps?: string[];
  imageUrl?: string;
  imageUrls?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, contextPrompt, videoDuration } = await req.json();

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
    if (project.transcript) {
      console.log("Using transcript from project:", project.transcript.substring(0, 100) + "...");
      contentForProcessing = project.transcript;
    } else if (project.source_type === 'transcript' && project.transcript) {
      contentForProcessing = project.transcript;
    } else if (project.source_type === 'video' || project.source_type === 'url') {
      // If no transcript but we have a video, inform the user
      return new Response(
        JSON.stringify({ 
          error: "No transcript available for this project",
          details: "Please run the transcription process first" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Content not available for processing" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use either contextPrompt passed in the request or the one stored in the project
    const finalContextPrompt = contextPrompt || project.context_prompt || '';

    // Extract a rough word count for reference
    const wordCount = contentForProcessing.split(/\s+/).length;
    
    // If the slides_per_minute is set in the project and > 0, use it as an override (for developer mode)
    // Otherwise, let the AI decide based on content
    const targetSlideCount = project.slides_per_minute && project.slides_per_minute > 0
      ? Math.round((wordCount / 150) * project.slides_per_minute) // 150 words per minute is a rough estimate
      : 0; // 0 means AI decides

    // Process with AI and track token usage
    const { slideDeck, usageData } = await generateSlidesWithAI(
      contentForProcessing, 
      project.title, 
      finalContextPrompt,
      targetSlideCount,
      project.user_id,
      projectId,
      videoDuration // Pass video duration to generateSlidesWithAI function
    );
    
    // Insert usage data into openai_usage table
    if (usageData) {
      const { error: usageError } = await supabase
        .from('openai_usage')
        .insert({
          user_id: project.user_id,
          project_id: projectId,
          model_id: usageData.model,
          input_tokens: usageData.inputTokens,
          output_tokens: usageData.outputTokens,
          total_tokens: usageData.totalTokens,
          estimated_cost: usageData.estimatedCost
        });

      if (usageError) {
        console.error("Error recording token usage:", usageError);
        // Continue with the function even if usage tracking fails
      }
    }
    
    // Update project with generated slides
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        slides: slideDeck,
        target_slide_count: slideDeck.length, // Store the actual number of slides created
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

// Define a type for token usage data
interface UsageData {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

async function generateSlidesWithAI(
  content: string, 
  title: string, 
  contextPrompt: string = '', 
  targetSlideCount: number = 0,
  userId: string,
  projectId: string,
  videoDuration?: number // Add video duration parameter
): Promise<{ slideDeck: Slide[], usageData: UsageData }> {
  if (!openAIKey) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    // Incorporate the contextPrompt into the system prompt if provided
    let contextInfo = '';
    if (contextPrompt && contextPrompt.trim()) {
      contextInfo = `\nAdditional context from the user:\n${contextPrompt.trim()}\n\nUse this context to guide your slide creation. The context may include instructions on what to focus on, what to skip, or how to maintain consistency with other content.`;
    }

    // Create a prompt that asks AI to determine the optimal slide count
    // unless a specific targetSlideCount is provided (for developer override)
    const optimalSlideInstructions = targetSlideCount > 0 
      ? `The user wants approximately ${targetSlideCount} slides in total. Adjust your content grouping accordingly.`
      : `Generate the optimal number of slides for effective studying. Segment the video into logical ideas, transitions, and key points. Avoid creating slides for filler content or repetitive information. Ensure the final slideset is concise, focused, and ideal for exam preparation or deep learning.`;

    // Add specific timestamp instructions based on video duration
    let timestampInstructions = `
    IMPORTANT INSTRUCTIONS FOR TIMESTAMPS:
    - For each slide, identify 1-4 key moments from the transcript that the slide content references
    - Include timestamps for these moments in the "transcriptTimestamps" array
    - For longer, content-rich slides, include more timestamps (up to 4)
    - For simpler slides, 1-2 timestamps is sufficient
    - If timestamps are explicitly mentioned in the transcript (like "at 00:05:32"), use those exact timestamps
    - Otherwise, make your best estimation of where in the transcript the content appears
    - The goal is to extract frames from these timestamps to provide visual context for each slide
    `;
    
    // Add video duration constraint if available
    if (videoDuration) {
      const formattedDuration = formatDuration(videoDuration);
      timestampInstructions += `
    CRITICAL VIDEO DURATION CONSTRAINT:
    - This video is exactly ${videoDuration} seconds long (${formattedDuration})
    - All timestamps MUST be within the range 00:00:00 to ${formattedDuration}
    - DO NOT generate any timestamps beyond ${formattedDuration}
    - If you're unsure about a timestamp's position, choose an earlier one within the video's duration
    - Double check all timestamps to ensure they are valid and within the video length
    `;
    }

    const prompt = `
    You are a professional presentation creator. Create a well-structured slide deck based on the following content.
    Format the output as a JSON array of slide objects, where each slide has:
    - id (string): a unique identifier like "slide-1"
    - title (string): a concise, informative title
    - content (string): bullet points separated by '\\n• ' (newline and bullet)
    - transcriptTimestamps (array of strings): include 1-4 timestamps from the transcript that this slide covers, in "00:05:32" format
    
    For the main title slide, use the title: "${title}"
    
    ${optimalSlideInstructions}
    
    IMPORTANT:
    - DO NOT create a conclusion or summary slide
    - DO NOT include any slides titled "Conclusion", "Summary", or similar
    - The last slide should be on the last topic from the content, not a summary
    
    Here's the content to transform into slides:
    ${content}
    ${contextInfo}
    
    ${timestampInstructions}
    `;

    const model = "gpt-4o-mini"; // Using the faster model for cost and speed
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a professional presentation creator specialized in creating well-organized slide decks with visual context."
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

    // Calculate token usage and cost
    // GPT-4o mini pricing: $0.15 per 1M input tokens, $0.6 per 1M output tokens
    const inputTokens = data.usage.prompt_tokens;
    const outputTokens = data.usage.completion_tokens;
    const totalTokens = data.usage.total_tokens;
    
    const inputCost = (inputTokens / 1000000) * 0.15;
    const outputCost = (outputTokens / 1000000) * 0.6;
    const estimatedCost = inputCost + outputCost;
    
    const usageData: UsageData = {
      model: model,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      totalTokens: totalTokens,
      estimatedCost: estimatedCost
    };

    console.log(`Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens}, Cost: $${estimatedCost.toFixed(4)}`);

    // Parse JSON safely
    try {
      const slides: Slide[] = JSON.parse(slidesContent);
      
      // Process each slide to ensure it has the expected format and validate timestamps
      const processedSlides = slides.map((slide, index) => {
        // Ensure transcriptTimestamps is an array
        const transcriptTimestamps = Array.isArray(slide.transcriptTimestamps) 
          ? slide.transcriptTimestamps 
          : (slide.timestamp ? [slide.timestamp] : []);
          
        // Validate timestamps against video duration if available
        let validatedTimestamps = transcriptTimestamps;
        if (videoDuration) {
          validatedTimestamps = transcriptTimestamps
            .filter(timestamp => {
              const seconds = timestampToSeconds(timestamp);
              const isValid = seconds <= videoDuration;
              if (!isValid) {
                console.log(`Filtering out invalid timestamp: ${timestamp} (${seconds}s) exceeds video duration of ${videoDuration}s`);
              }
              return isValid;
            });
        }
        
        // Limit to max 4 timestamps to keep things manageable
        const limitedTimestamps = validatedTimestamps.slice(0, 4);
        
        return {
          ...slide,
          id: slide.id || `slide-${index + 1}`,
          transcriptTimestamps: limitedTimestamps
        };
      });
      
      return { slideDeck: processedSlides, usageData };
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      console.log("Raw response:", slidesContent);
      
      // Return a fallback slide deck
      return { 
        slideDeck: [
          {
            id: "slide-1",
            title: title || "Introduction",
            content: "• Failed to generate slides\n• Please try again later"
          }
        ],
        usageData: usageData 
      };
    }
  } catch (error) {
    console.error("Error generating slides with AI:", error);
    throw new Error(`Failed to generate slides: ${error.message}`);
  }
}

// Helper function to convert timestamp string (e.g., "00:05:32") to seconds
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    // Format: HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // Format: MM:SS
    return parts[0] * 60 + parts[1];
  } else {
    return 0;
  }
}

// Helper function to format seconds to timestamp string (e.g., "00:05:32")
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
