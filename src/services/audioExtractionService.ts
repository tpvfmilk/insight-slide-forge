import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AudioChunk, AudioChunkMetadata, chunkAudioFile, uploadAudioChunks } from "./audioChunkingService";

/**
 * Service for handling audio extraction from videos
 * This implementation extracts audio from video files in the browser
 */

/**
 * Extract audio from a video file using the Web Audio API
 * @param videoFile File object of the video to extract audio from
 * @param progressCallback Optional callback function for tracking extraction progress
 * @returns Promise with the extracted audio as a Blob
 */
export const extractAudioFromVideo = async (
  videoFile: File,
  progressCallback?: (progress: number) => void
): Promise<Blob> => {
  try {
    // Create a URL for the video file
    const videoURL = URL.createObjectURL(videoFile);
    
    // Set up audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create video element to extract audio from
    const video = document.createElement('video');
    
    // Create a promise that resolves when the video metadata is loaded
    const metadataLoaded = new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });
    
    // Set video source
    video.src = videoURL;
    video.crossOrigin = "anonymous";
    
    // Wait for metadata to be loaded
    await metadataLoaded;
    
    // Set video to the beginning
    video.currentTime = 0;
    
    // Create media recorder to capture audio
    const videoTotalTime = video.duration;
    
    // Create source and destination nodes
    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    
    // Also connect to audio output if needed
    source.connect(audioContext.destination);
    
    // Set up media recorder
    const mediaRecorder = new MediaRecorder(destination.stream);
    const audioChunks: BlobPart[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    // Create a promise that resolves when recording is stopped
    const recordingFinished = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        URL.revokeObjectURL(videoURL); // Clean up
        resolve(audioBlob);
      };
    });
    
    // Start recording and playing
    mediaRecorder.start();
    video.play();
    
    // Set up progress tracking
    if (progressCallback) {
      const progressInterval = setInterval(() => {
        if (video.currentTime > 0) {
          const currentProgress = Math.min((video.currentTime / videoTotalTime) * 100, 100);
          progressCallback(currentProgress);
        }
        
        if (video.ended || video.currentTime >= videoTotalTime) {
          clearInterval(progressInterval);
        }
      }, 500);
    }
    
    // Wait for video to finish playing
    const playbackFinished = new Promise<void>((resolve) => {
      video.onended = () => {
        mediaRecorder.stop();
        resolve();
      };
    });
    
    await playbackFinished;
    const audioBlob = await recordingFinished;
    
    // Clean up
    video.remove();
    await audioContext.close();
    
    // Return the audio blob
    return audioBlob;
  } catch (error) {
    console.error("Error extracting audio:", error);
    toast.error(`Audio extraction failed: ${error.message || "Unknown error"}`);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
};

/**
 * Upload the full extracted audio to storage
 * @param audioBlob The audio blob to upload
 * @param projectId The project ID for storage
 * @param progressCallback Optional callback for tracking progress
 * @returns Promise with information about the uploaded file
 */
export const uploadFullAudio = async (
  audioBlob: Blob,
  projectId: string,
  progressCallback?: (progress: number) => void
): Promise<{
  success: boolean;
  path?: string;
  error?: string;
  size?: number;
}> => {
  try {
    if (!audioBlob) {
      throw new Error("No audio data provided");
    }
    
    // Format the file path
    const fileName = `full_audio_${Date.now()}.mp3`;
    const filePath = `projects/${projectId}/${fileName}`;
    
    console.log(`Uploading full audio (${(audioBlob.size / (1024 * 1024)).toFixed(2)} MB) to path: ${filePath}`);
    
    // Start progress tracking
    if (progressCallback) progressCallback(10);
    
    // Upload to audio_extracts bucket (with no size limit)
    const { data, error } = await supabase.storage
      .from('audio_extracts')
      .upload(filePath, audioBlob, {
        contentType: 'audio/mp3',
        upsert: true
      });
      
    if (error) {
      console.error("Error uploading full audio:", error);
      throw error;
    }
    
    if (progressCallback) progressCallback(100);
    
    return {
      success: true,
      path: filePath,
      size: audioBlob.size
    };
  } catch (error) {
    console.error("Failed to upload full audio:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Extract audio and chunk it for processing
 * @param videoFile Video file to extract audio from
 * @param projectId Project ID for storage
 * @param options Extraction options including max chunk size
 * @param progressCallback Progress tracking callback
 * @returns Promise with information about the extraction and chunking process
 */
export const extractAndChunkAudio = async (
  videoFile: File,
  projectId: string,
  options: {
    maxChunkDuration?: number;
    maxChunkSizeMB?: number;
    format?: 'mp3' | 'wav';
    quality?: 'low' | 'medium' | 'high';
  } = {},
  progressCallback?: (progress: number, stage: string) => void
): Promise<{
  success: boolean;
  audioBlob?: Blob;
  fullAudioPath?: string;
  chunks?: AudioChunkMetadata[];
  error?: string;
}> => {
  try {
    // Extract audio from video
    if (progressCallback) progressCallback(0, "Extracting audio from video");
    
    // Update progress for extraction (0-40%)
    const extractionProgressCallback = (progress: number) => {
      if (progressCallback) progressCallback(progress * 0.4, "Extracting audio from video");
    };
    
    // Extract full audio from the video file
    const audioBlob = await extractAudioFromVideo(videoFile, extractionProgressCallback);
    
    console.log(`Extracted audio: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Upload the full audio to storage first (40-60%)
    if (progressCallback) progressCallback(40, "Uploading full audio");
    
    const uploadProgressCallback = (progress: number) => {
      if (progressCallback) progressCallback(40 + progress * 0.2, "Uploading full audio");
    };
    
    const fullAudioResult = await uploadFullAudio(
      audioBlob,
      projectId,
      uploadProgressCallback
    );
    
    if (!fullAudioResult.success) {
      throw new Error(`Failed to upload full audio: ${fullAudioResult.error}`);
    }
    
    // Chunk the extracted audio into smaller pieces
    if (progressCallback) progressCallback(60, "Chunking audio");
    
    // Update progress for chunking (60-80%)
    const chunkingProgressCallback = (progress: number) => {
      if (progressCallback) progressCallback(60 + progress * 0.2, "Chunking audio");
    };
    
    // Set the maximum chunk size to 20MB (as requested in the spec)
    // Default chunk duration is 60 seconds, but will adjust based on audio quality to stay under 20MB
    const chunkingResult = await chunkAudioFile(
      audioBlob,
      options.maxChunkDuration || 60,
      options.maxChunkSizeMB || 20,
      chunkingProgressCallback
    );
    
    if (!chunkingResult.success) {
      throw new Error(`Failed to chunk audio: ${chunkingResult.error}`);
    }
    
    console.log(`Created ${chunkingResult.chunks.length} audio chunks`);
    
    // Upload the chunks to storage
    if (progressCallback) progressCallback(80, "Uploading audio chunks");
    
    // Update progress for upload (80-100%)
    const chunksUploadProgressCallback = (progress: number) => {
      if (progressCallback) progressCallback(80 + progress * 0.2, "Uploading audio chunks");
    };
    
    // Re-create AudioChunk objects since we only have metadata
    const audioChunks: AudioChunk[] = await Promise.all(
      chunkingResult.chunks.map(async (chunkMeta, index) => {
        // Create the actual chunk again
        const offlineCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await audioBlob.slice(
          0, 
          audioBlob.size
        ).arrayBuffer();
        
        const start = chunkMeta.startTime / chunkingResult.originalDuration;
        const end = chunkMeta.endTime / chunkingResult.originalDuration;
        const chunkSize = end - start;
        
        // Estimate the byte range based on proportion of the file
        const startByte = Math.floor(start * audioBlob.size);
        const endByte = Math.floor(end * audioBlob.size);
        
        // Create a new blob for this chunk
        const chunkBlob = audioBlob.slice(startByte, endByte);
        
        return {
          blob: chunkBlob,
          startTime: chunkMeta.startTime,
          endTime: chunkMeta.endTime,
          index: chunkMeta.index,
          duration: chunkMeta.duration,
          size: chunkBlob.size
        };
      })
    );
    
    // Upload chunks to storage (with 20MB limit)
    const uploadedChunks = await uploadAudioChunks(
      projectId, 
      audioChunks,
      chunksUploadProgressCallback
    );
    
    // Final progress update
    if (progressCallback) progressCallback(100, "Audio processing complete");
    
    return {
      success: true,
      audioBlob,
      fullAudioPath: fullAudioResult.path,
      chunks: uploadedChunks
    };
  } catch (error) {
    console.error("Error in audio extraction and chunking:", error);
    
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Process audio chunks for transcription
 * @param projectId Project ID
 * @param chunks Array of audio chunk metadata
 * @returns Promise with transcription results
 */
export const transcribeAudioChunks = async (
  projectId: string,
  chunks: AudioChunkMetadata[],
  progressCallback?: (progress: number) => void
): Promise<{
  success: boolean;
  transcript?: string;
  processedCount: number;
  failedCount: number;
  error?: string;
}> => {
  try {
    if (!chunks || chunks.length === 0) {
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        error: "No audio chunks provided"
      };
    }
    
    console.log(`Transcribing ${chunks.length} audio chunks`);
    
    // Call the edge function to transcribe the audio chunks
    const { data, error } = await supabase.functions.invoke('transcribe-audio-chunks', {
      body: {
        projectId,
        chunks
      }
    });
    
    if (error) {
      console.error("Error transcribing audio chunks:", error);
      return {
        success: false,
        processedCount: 0,
        failedCount: chunks.length,
        error: error.message
      };
    }
    
    return {
      success: true,
      transcript: data.transcript,
      processedCount: data.processedCount || 0,
      failedCount: data.failedCount || 0
    };
  } catch (error) {
    console.error("Error in transcribeAudioChunks:", error);
    
    return {
      success: false,
      processedCount: 0,
      failedCount: chunks.length,
      error: error.message
    };
  }
};

// This function is now a placeholder - we'll use our new audio chunking approach instead
export const batchExtractAudio = async (
  projectId: string,
  chunks: Array<{ 
    videoPath: string; 
    index: number; 
    startTime: number; 
    endTime?: number;
  }>
): Promise<{
  success: boolean;
  processedCount: number;
  failedCount: number;
  audioPaths: string[];
}> => {
  // This function would handle batch processing but we're updating it to be a placeholder
  // until we implement the full production version
  console.warn("Using new audio-first chunking approach instead of batch video extraction");
  
  return {
    success: false,
    processedCount: 0,
    failedCount: chunks.length,
    audioPaths: []
  };
};

// This is a placeholder function meant to be replaced with the real implementation
// in the production environment. For now, it returns a mock response.
export const serverExtractAudioFromVideo = async (
  videoPath: string,
  projectId: string,
  options: {
    chunkIndex?: number;
    format?: 'mp3' | 'wav' | 'aac';
    quality?: 'low' | 'medium' | 'high';
  } = {}
): Promise<{ success: boolean; audioPath?: string; error?: string }> => {
  try {
    const {
      chunkIndex = 0,
      format = 'mp3',
      quality = 'medium'
    } = options;
    
    // This is where we'd call our dedicated FFmpeg service in production
    // For now, we'll call the edge function placeholder
    const response = await supabase.functions.invoke('extract-audio', {
      body: {
        videoPath,
        projectId,
        chunkIndex,
        format,
        quality
      }
    });
    
    if (response.error) {
      throw new Error(`Audio extraction service error: ${response.error.message}`);
    }
    
    const result = response.data;
    
    // Check if we got a proper response
    if (!result.success) {
      console.warn("Audio extraction placeholder called successfully but returned failure status");
      
      // Show a toast explaining the implementation needed for production
      toast.info(
        "Audio extraction requires FFmpeg which is not available in Edge Functions. " +
        "For production, implement a dedicated server with FFmpeg."
      );
      
      return {
        success: false,
        error: "Audio extraction requires production implementation with FFmpeg"
      };
    }
    
    // In a real implementation, we'd return the path to the extracted audio
    return {
      success: true,
      audioPath: `audio_extracts/${projectId}/chunk_${chunkIndex}.${format}`,
    };
  } catch (error) {
    console.error("Error in audio extraction service:", error);
    
    return {
      success: false,
      error: error.message
    };
  }
};
