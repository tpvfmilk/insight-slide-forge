import { formatDuration, timestampToSeconds } from "./formatUtils";

/**
 * Cleans up common transcript issues like double spaces, trailing spaces, etc.
 * @param transcript Raw transcript text
 * @returns Cleaned transcript text
 */
export const cleanupTranscript = (transcript: string): string => {
  if (!transcript) return '';
  
  return transcript
    .replace(/\s+/g, ' ')              // Replace multiple spaces with a single space
    .replace(/\n{3,}/g, '\n\n')        // Replace 3+ line breaks with double line break
    .replace(/^\s+|\s+$/gm, '')        // Trim each line
    .trim();                           // Trim the entire string
};

/**
 * Enhances transcript by adding paragraph breaks at logical points
 * @param transcript Raw transcript text
 * @param minSentences Minimum number of sentences before considering a paragraph break
 * @returns Transcript with paragraph breaks
 */
export const splitIntoParagraphs = (transcript: string, minSentences: number = 2): string => {
  if (!transcript) return '';
  
  // Split by sentence endings (., !, ?) followed by a space and capital letter or newline
  const sentences = transcript.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  
  if (sentences.length <= minSentences) return transcript;
  
  let result = '';
  let sentenceCount = 0;
  
  for (const sentence of sentences) {
    result += sentence;
    sentenceCount++;
    
    // Add paragraph break after several sentences at logical pause points
    if (sentenceCount >= minSentences && 
        (sentence.trim().endsWith('.') || sentence.trim().endsWith('!') || sentence.trim().endsWith('?'))) {
      // Check if the sentence discusses a new topic (simple heuristic)
      if (sentence.includes('However,') || sentence.includes('Moreover,') || 
          sentence.includes('In addition,') || sentence.includes('Furthermore,')) {
        result += '\n\n';
        sentenceCount = 0;
      } else if (sentenceCount >= 4) { // Force break after 4+ sentences
        result += '\n\n';
        sentenceCount = 0;
      }
    }
  }
  
  return result;
};

/**
 * Formats a transcript with consistent speaker labels and proper spacing
 * @param transcript Raw transcript that might contain speaker labels
 * @returns Formatted transcript with consistent speaker labels
 */
export const formatWithSpeakers = (transcript: string): string => {
  if (!transcript) return '';
  
  // Regular expression to detect speaker patterns (e.g., "Speaker 1:", "John:", etc.)
  const speakerRegex = /(?:^|\n)([A-Za-z\s]+):\s*/g;
  
  // Extract all speaker names to normalize them
  const speakerMatches = Array.from(transcript.matchAll(speakerRegex));
  const speakerNames = new Map<string, string>();
  
  // First pass: collect all speaker names
  speakerMatches.forEach(match => {
    const speakerName = match[1].trim();
    if (!speakerNames.has(speakerName.toLowerCase())) {
      // If it looks like "Speaker X" already, keep it, otherwise create a new label
      if (speakerName.toLowerCase().startsWith('speaker')) {
        speakerNames.set(speakerName.toLowerCase(), speakerName);
      } else {
        // Convert to standard format "Speaker N"
        speakerNames.set(speakerName.toLowerCase(), `Speaker ${speakerNames.size + 1}`);
      }
    }
  });
  
  // Second pass: normalize speaker names and format transcript
  let formattedTranscript = transcript;
  
  speakerNames.forEach((standardName, originalNameLower) => {
    // Replace all occurrences of this speaker with the standard name
    const regex = new RegExp(`(?:^|\\n)(${originalNameLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}):\\s*`, 'gi');
    formattedTranscript = formattedTranscript.replace(regex, `\n\n${standardName}: `);
  });
  
  // Final cleanup to ensure proper spacing
  return formattedTranscript
    .replace(/\n{3,}/g, '\n\n')   // Replace 3+ line breaks with double line break
    .trim();                      // Remove leading/trailing whitespace
};

/**
 * Adds timestamp markers to a transcript based on provided segments or estimates
 * @param transcript Transcript text
 * @param segments Optional array of transcript segments with timestamps
 * @returns Transcript with timestamp markers
 */
export const addTimestamps = (
  transcript: string, 
  segments?: Array<{ text: string, start: number }> | null
): string => {
  if (!transcript) return '';
  if (!segments || segments.length === 0) {
    // If no segments provided, estimate timestamps based on 130 words per minute
    const words = transcript.split(/\s+/);
    const wordsPerMinute = 130;
    const wordsPerSecond = wordsPerMinute / 60;
    
    let formattedTranscript = '';
    const timestampInterval = 60; // Add timestamp every 60 seconds
    let wordIndex = 0;
    
    while (wordIndex < words.length) {
      // Calculate how many seconds have passed based on word count
      const seconds = Math.floor(wordIndex / wordsPerSecond);
      
      // Add a timestamp every minute
      if (seconds % timestampInterval === 0 && wordIndex > 0) {
        formattedTranscript += `\n[${formatDuration(seconds)}] `;
      }
      
      // Add words until next timestamp
      const wordsToAdd = Math.min(
        Math.floor(wordsPerSecond * timestampInterval), 
        words.length - wordIndex
      );
      
      formattedTranscript += words.slice(wordIndex, wordIndex + wordsToAdd).join(' ') + ' ';
      wordIndex += wordsToAdd;
    }
    
    return formattedTranscript.trim();
  } else {
    // Use provided segments for accurate timestamps
    return segments.map(segment => 
      `[${formatDuration(segment.start)}] ${segment.text}`
    ).join('\n');
  }
};

/**
 * Process raw transcript data from OpenAI Whisper API into a formatted transcript
 * @param transcriptionData Raw data from OpenAI Whisper API
 * @param options Formatting options
 * @returns Formatted transcript 
 */
export const formatTranscriptFromWhisper = (
  transcriptionData: any, 
  options: {
    includeTimestamps?: boolean;
    formatSpeakers?: boolean;
    addParagraphs?: boolean;
  } = {}
): string => {
  const { includeTimestamps = true, formatSpeakers = true, addParagraphs = true } = options;
  
  if (!transcriptionData) {
    return '';
  }
  
  // If it's just plain text, return it
  if (typeof transcriptionData === 'string') {
    return transcriptionData;
  }
  
  // If it's a response with segments or speaker detection
  let transcript = '';
  
  // Process with speaker detection if available
  if (transcriptionData.segments && Array.isArray(transcriptionData.segments)) {
    let currentSpeaker = null;
    const segments: Array<{text: string, speaker?: number, start?: number}> = transcriptionData.segments;
    
    if (formatSpeakers && segments.some(segment => segment.speaker !== undefined)) {
      // Format with speaker labels
      for (const segment of segments) {
        if (segment.speaker !== currentSpeaker) {
          transcript += '\n\n';
          transcript += `Speaker ${segment.speaker}: `;
          currentSpeaker = segment.speaker;
        } else {
          transcript += ' ';
        }
        transcript += segment.text;
      }
    } else {
      // Format with timestamps if requested
      for (const segment of segments) {
        if (includeTimestamps && segment.start !== undefined) {
          transcript += `[${formatDuration(segment.start)}] `;
        }
        transcript += segment.text + ' ';
      }
    }
  } else if (transcriptionData.text) {
    // Basic text response
    transcript = transcriptionData.text;
  }
  
  // Apply additional formatting
  transcript = cleanupTranscript(transcript);
  
  if (addParagraphs) {
    transcript = splitIntoParagraphs(transcript);
  }
  
  return transcript.trim();
};

/**
 * Checks if a transcript contains multiple video sections
 * (identified by markdown headers)
 * @param transcript The transcript text to check
 * @returns Boolean indicating if the transcript has multiple video sections
 */
export const hasMultipleVideoSections = (transcript: string): boolean => {
  if (!transcript) return false;
  
  // Check for markdown headers that indicate video sections
  const videoSectionRegex = /^\s*#{1,3}\s+.+$/gm;
  const matches = transcript.match(videoSectionRegex);
  
  return matches !== null && matches.length > 0;
};

/**
 * Extracts video section headers from a transcript
 * @param transcript The transcript text to parse
 * @returns Array of video section headers
 */
export const extractVideoSections = (transcript: string): string[] => {
  if (!transcript) return [];
  
  const videoSectionRegex = /^\s*(#{1,3}\s+.+)$/gm;
  const matches = Array.from(transcript.matchAll(videoSectionRegex));
  
  return matches.map(match => match[1].trim());
};

/**
 * Processes OpenAI Whisper API transcript to include section headers
 * @param whisperText Raw text transcript from Whisper API
 * @param videoTitle Title of the video for section header
 * @param startTime Start time of the section in seconds
 * @param endTime End time of the section in seconds 
 * @returns Formatted transcript with section header
 */
export const formatWhisperTranscriptSection = (
  whisperText: string,
  videoTitle: string,
  partNumber: number,
  startTime: number,
  endTime: number
): string => {
  if (!whisperText) return '';
  
  // Create the section header
  const sectionHeader = `## ${videoTitle} - Part ${partNumber} (${formatDuration(startTime)} to ${formatDuration(endTime)})`;
  
  // Format and clean up the text
  let cleanedText = cleanupTranscript(whisperText);
  cleanedText = splitIntoParagraphs(cleanedText);
  
  // Combine header and text
  return `${sectionHeader}\n\n${cleanedText}`;
};

/**
 * Combines multiple chunk transcriptions into a single cohesive transcript
 * @param chunkTranscripts Array of transcripts from different chunks
 * @returns Combined transcript
 */
export const combineChunkTranscripts = (chunkTranscripts: string[]): string => {
  if (!chunkTranscripts || chunkTranscripts.length === 0) return '';
  
  // Filter out empty transcripts
  const validTranscripts = chunkTranscripts.filter(t => !!t);
  
  if (validTranscripts.length === 0) return '';
  
  // If there's only one chunk, return it directly
  if (validTranscripts.length === 1) return validTranscripts[0];
  
  // Otherwise, combine them with appropriate spacing
  return validTranscripts.join('\n\n');
};

/**
 * Process audio chunk for transcription with proper optimization
 * @param audioData Audio blob data
 * @param options Transcription options
 * @returns Promise with transcription result
 */
export const processAudioChunk = async (
  audioData: Blob,
  options: {
    apiKey: string;
    language?: string;
    detectSpeakers?: boolean;
  }
): Promise<any> => {
  try {
    const formData = new FormData();
    formData.append('file', audioData, 'chunk.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    
    if (options.language) {
      formData.append('language', options.language);
    }
    
    // Call the Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whisper API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error processing audio chunk:", error);
    throw error;
  }
};
