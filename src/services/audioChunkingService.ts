
/**
 * Audio chunking service
 * Handles chunking of audio files for more efficient processing
 */
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface AudioChunk {
  blob: Blob;
  startTime: number;
  endTime: number;
  index: number;
  duration: number;
  size: number;
}

export interface AudioChunkMetadata {
  startTime: number;
  endTime: number;
  index: number;
  duration: number;
  size: number;
  path?: string; // Storage path when uploaded
  status?: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface AudioChunkingResult {
  originalDuration: number;
  chunks: AudioChunkMetadata[];
  success: boolean;
  error?: string;
}

/**
 * Chunks an audio blob into smaller segments
 * @param audioBlob The audio blob to chunk
 * @param maxChunkDuration Maximum duration in seconds for each chunk 
 * @param progressCallback Optional callback for tracking progress
 * @returns Promise with metadata about the chunks
 */
export const chunkAudioFile = async (
  audioBlob: Blob, 
  maxChunkDuration: number = 60, // Default to 60 second chunks
  progressCallback?: (progress: number) => void
): Promise<AudioChunkingResult> => {
  try {
    // Set up audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create an audio source from the blob
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Calculate total duration
    const totalDuration = audioBuffer.duration;
    const totalChunks = Math.ceil(totalDuration / maxChunkDuration);
    
    console.log(`Chunking audio file: ${totalDuration.toFixed(2)}s into ~${totalChunks} chunks`);
    
    // Create chunks
    const chunks: AudioChunk[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      if (progressCallback) {
        progressCallback((i / totalChunks) * 100);
      }
      
      const startTime = i * maxChunkDuration;
      const endTime = Math.min((i + 1) * maxChunkDuration, totalDuration);
      const chunkDuration = endTime - startTime;
      
      // Create an offline audio context for this chunk
      const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioContext.sampleRate * chunkDuration,
        audioContext.sampleRate
      );
      
      // Create a buffer source for the chunk
      const bufferSource = offlineCtx.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(offlineCtx.destination);
      
      // Start the buffer source at the chunk's start time
      bufferSource.start(0, startTime, chunkDuration);
      
      // Render the chunk
      const renderedBuffer = await offlineCtx.startRendering();
      
      // Convert the chunk to a blob
      const audioData = exportBufferToWav(renderedBuffer);
      const chunkBlob = new Blob([audioData], { type: 'audio/wav' });
      
      chunks.push({
        blob: chunkBlob,
        startTime,
        endTime,
        index: i,
        duration: chunkDuration,
        size: chunkBlob.size
      });
      
      console.log(`Created chunk ${i + 1}/${totalChunks}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${(chunkBlob.size / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    // Clean up
    await audioContext.close();
    
    // Create metadata for the chunks
    const chunkMetadata: AudioChunkMetadata[] = chunks.map(chunk => ({
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      index: chunk.index,
      duration: chunk.duration,
      size: chunk.size,
      status: 'pending'
    }));
    
    // Final progress update
    if (progressCallback) {
      progressCallback(100);
    }
    
    return {
      originalDuration: totalDuration,
      chunks: chunkMetadata,
      success: true
    };
  } catch (error) {
    console.error("Error chunking audio:", error);
    toast.error(`Failed to chunk audio: ${error.message || "Unknown error"}`);
    return {
      originalDuration: 0,
      chunks: [],
      success: false,
      error: error.message || "Unknown error"
    };
  }
};

/**
 * Uploads audio chunks to storage
 * @param projectId Project ID
 * @param chunks Array of audio chunks
 * @param progressCallback Optional callback for tracking progress
 * @returns Promise with updated chunk metadata
 */
export const uploadAudioChunks = async (
  projectId: string,
  chunks: AudioChunk[],
  progressCallback?: (progress: number) => void
): Promise<AudioChunkMetadata[]> => {
  const results: AudioChunkMetadata[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkProgress = (i / chunks.length) * 100;
    
    if (progressCallback) {
      progressCallback(chunkProgress);
    }
    
    try {
      // Create a file from the chunk blob
      const fileName = `chunk_${chunk.index.toString().padStart(3, '0')}.wav`;
      const filePath = `projects/${projectId}/audio/${fileName}`;
      
      // Upload the chunk
      const { data, error } = await supabase.storage
        .from('audio_chunks')
        .upload(filePath, chunk.blob, {
          contentType: 'audio/wav',
          upsert: true
        });
      
      if (error) {
        console.error(`Error uploading chunk ${chunk.index}:`, error);
        results.push({
          ...chunk,
          status: 'error',
          error: error.message
        });
      } else {
        results.push({
          ...chunk,
          path: filePath,
          status: 'completed'
        });
      }
    } catch (error) {
      console.error(`Error processing chunk ${chunk.index}:`, error);
      results.push({
        ...chunk,
        status: 'error',
        error: error.message
      });
    }
  }
  
  // Final progress update
  if (progressCallback) {
    progressCallback(100);
  }
  
  return results;
};

/**
 * Exports an audio buffer to a WAV file
 * Based on: https://github.com/Jam3/audiobuffer-to-wav
 * @param buffer The audio buffer to export
 * @returns ArrayBuffer containing WAV data
 */
function exportBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16; // 16-bit
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const headerByteLength = 44;
  const dataByteLength = buffer.length * numChannels * bytesPerSample;
  const fileByteLength = headerByteLength + dataByteLength;
  
  const arrayBuffer = new ArrayBuffer(fileByteLength);
  const view = new DataView(arrayBuffer);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, fileByteLength - 8, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataByteLength, true);
  
  // Write audio data
  const offset = headerByteLength;
  let channelData: Float32Array[] = [];
  
  // Extract channel data arrays
  for (let channel = 0; channel < numChannels; channel++) {
    channelData[channel] = buffer.getChannelData(channel);
  }
  
  // Interleave channel data and convert to 16-bit PCM
  let pos = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      // Scale Float32Array values (-1 to 1) to 16-bit PCM range
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      const value = sample < 0 ? sample * 32768 : sample * 32767;
      
      // Write 16-bit sample
      view.setInt16(offset + pos, value, true);
      pos += bytesPerSample;
    }
  }
  
  return arrayBuffer;
}

// Helper function to write strings to DataView
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
