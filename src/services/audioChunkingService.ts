
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const MAX_CHUNK_SIZE_MB = 20; // 20 MB maximum size per chunk

// Audio chunk type definition
export interface AudioChunk {
  blob: Blob;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
}

// Type for audio chunk metadata (without the binary data)
export interface AudioChunkMetadata {
  index: number;
  startTime: number;
  endTime?: number;
  duration: number;
  audioPath: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  text?: string;
}

/**
 * Creates an audio element from a blob URL and returns a promise that resolves
 * when the audio metadata is loaded
 * @param audioBlob Audio blob to create an element for
 * @returns Promise with the created audio element
 */
const createAudioElementFromBlob = async (audioBlob: Blob): Promise<HTMLAudioElement> => {
  return new Promise((resolve, reject) => {
    const audioElement = document.createElement('audio');
    audioElement.src = URL.createObjectURL(audioBlob);
    
    const onMetadataLoaded = () => {
      resolve(audioElement);
      cleanup();
    };
    
    const onError = () => {
      reject(new Error("Failed to load audio metadata"));
      cleanup();
    };
    
    const cleanup = () => {
      audioElement.removeEventListener('loadedmetadata', onMetadataLoaded);
      audioElement.removeEventListener('error', onError);
    };
    
    // Set up event listeners
    audioElement.addEventListener('loadedmetadata', onMetadataLoaded);
    audioElement.addEventListener('error', onError);
    
    // Fallback if metadata doesn't load
    const timeout = setTimeout(() => {
      reject(new Error("Timeout loading audio metadata"));
      cleanup();
    }, 10000);
    
    audioElement.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
    });
  });
};

/**
 * Extracts a specific time range from an audio blob using OfflineAudioContext
 * @param audioBlob The full audio blob
 * @param startTime Start time in seconds
 * @param endTime End time in seconds
 * @returns Promise with the chunked audio blob
 */
const extractAudioChunk = async (
  audioBlob: Blob, 
  startTime: number, 
  endTime: number
): Promise<Blob> => {
  try {
    // Create an audio element to get the audio data
    const audioElement = await createAudioElementFromBlob(audioBlob);
    const audioDuration = audioElement.duration;
    
    // Validate time range
    if (startTime < 0) startTime = 0;
    if (endTime > audioDuration) endTime = audioDuration;
    if (startTime >= endTime) {
      throw new Error(`Invalid time range: ${startTime} to ${endTime}`);
    }
    
    // Calculate the chunk duration
    const chunkDuration = endTime - startTime;
    
    // Create an AudioContext
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create a buffer source from the audio element
    const audioArrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);
    
    // Calculate the start and end samples
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const chunkLength = endSample - startSample;
    
    // Create an offline audio context for the chunk
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      chunkLength,
      sampleRate
    );
    
    // Create a new buffer for the chunk
    const chunkBuffer = offlineContext.createBuffer(
      audioBuffer.numberOfChannels,
      chunkLength,
      sampleRate
    );
    
    // Copy the audio data for the chunk
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const chunkChannelData = chunkBuffer.getChannelData(channel);
      
      for (let i = 0; i < chunkLength; i++) {
        chunkChannelData[i] = channelData[startSample + i];
      }
    }
    
    // Create a buffer source for the chunk
    const chunkSource = offlineContext.createBufferSource();
    chunkSource.buffer = chunkBuffer;
    chunkSource.connect(offlineContext.destination);
    chunkSource.start();
    
    // Render the chunk
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert the rendered buffer to a blob
    const audioData = await encodeAudioBuffer(renderedBuffer);
    const chunkBlob = new Blob([audioData], { type: 'audio/mp3' });
    
    // Clean up
    URL.revokeObjectURL(audioElement.src);
    audioContext.close();
    
    return chunkBlob;
  } catch (error) {
    console.error('Error extracting audio chunk:', error);
    throw error;
  }
};

/**
 * Encodes an AudioBuffer to MP3 format
 * @param audioBuffer AudioBuffer to encode
 * @returns Promise with the encoded audio data
 */
const encodeAudioBuffer = async (audioBuffer: AudioBuffer): Promise<ArrayBuffer> => {
  // For simplicity, we'll convert to WAV format first
  // In a production environment, you might want to use a proper MP3 encoder library
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  
  // Create a WAV file
  const wavFile = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(wavFile);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);
  
  // Write audio data
  const channelData = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, value, true);
      offset += 2;
    }
  }
  
  return wavFile;
};

/**
 * Chunk an audio file into smaller pieces for processing
 * @param audioBlob The full audio blob to chunk
 * @param maxChunkDurationSecs Maximum duration of each chunk in seconds
 * @param maxChunkSizeMB Maximum size of each chunk in MB
 * @param progressCallback Optional callback for tracking chunking progress
 * @returns Promise with array of chunk metadata
 */
export const chunkAudioFile = async (
  audioBlob: Blob,
  maxChunkDurationSecs: number = 60,
  maxChunkSizeMB: number = MAX_CHUNK_SIZE_MB,
  progressCallback?: (progress: number) => void
): Promise<{
  success: boolean;
  chunks: AudioChunkMetadata[];
  originalDuration: number;
  error?: string;
}> => {
  try {
    // Create an audio element to get duration
    const audioElement = await createAudioElementFromBlob(audioBlob);
    
    // Get audio duration (in seconds)
    const duration = audioElement.duration || 0;
    
    console.log(`Audio duration: ${duration} seconds, size: ${audioBlob.size / (1024 * 1024)} MB`);
    
    if (duration === 0) {
      throw new Error("Failed to determine audio duration");
    }
    
    // Release the object URL
    URL.revokeObjectURL(audioElement.src);
    
    // Calculate bytes per second (rough estimation)
    const bytesPerSecond = audioBlob.size / duration;
    
    // Calculate optimal chunk duration to stay under maxChunkSizeMB
    // But don't exceed maxChunkDurationSecs
    const optimalChunkDuration = Math.min(
      maxChunkDurationSecs,
      (maxChunkSizeMB * 1024 * 1024) / bytesPerSecond
    );
    
    console.log(`Optimal chunk duration: ${optimalChunkDuration} seconds`);
    
    // Calculate number of chunks needed
    const numChunks = Math.ceil(duration / optimalChunkDuration);
    const chunks: AudioChunkMetadata[] = [];
    
    let startTime = 0;
    
    for (let i = 0; i < numChunks; i++) {
      // For the last chunk, make sure we don't exceed the total duration
      const chunkDuration = Math.min(optimalChunkDuration, duration - startTime);
      if (chunkDuration <= 0) break;
      
      const endTime = startTime + chunkDuration;
      
      // Add chunk metadata
      chunks.push({
        index: i,
        startTime,
        endTime,
        duration: chunkDuration,
        audioPath: `chunk_${i}.mp3`, // Placeholder path
        status: 'pending'
      });
      
      startTime = endTime;
      
      // Update progress if callback provided
      if (progressCallback) {
        const progress = ((i + 1) / numChunks) * 100;
        progressCallback(progress);
      }
    }
    
    console.log(`Created ${chunks.length} audio chunk metadata entries`);
    
    return {
      success: true,
      chunks,
      originalDuration: duration
    };
  } catch (error: any) {
    console.error("Error chunking audio:", error);
    return {
      success: false,
      chunks: [],
      originalDuration: 0,
      error: error.message
    };
  }
};

/**
 * Extract actual audio chunks from a blob using the chunk metadata
 * @param audioBlob Full audio blob
 * @param chunkMetadata Array of chunk metadata
 * @param progressCallback Optional callback for tracking progress
 * @returns Promise with array of complete audio chunks
 */
export const createActualAudioChunks = async (
  audioBlob: Blob,
  chunkMetadata: AudioChunkMetadata[],
  progressCallback?: (progress: number, currentChunk: number, totalChunks: number) => void
): Promise<AudioChunk[]> => {
  const chunks: AudioChunk[] = [];
  let totalProcessed = 0;
  
  for (let i = 0; i < chunkMetadata.length; i++) {
    const metadata = chunkMetadata[i];
    
    try {
      // Report progress
      if (progressCallback) {
        const progress = (totalProcessed / chunkMetadata.length) * 100;
        progressCallback(progress, i, chunkMetadata.length);
      }
      
      // Extract the actual audio chunk using time range
      const chunkBlob = await extractAudioChunk(
        audioBlob,
        metadata.startTime,
        metadata.endTime || (metadata.startTime + metadata.duration)
      );
      
      // Create a complete chunk with the extracted audio
      chunks.push({
        blob: chunkBlob,
        index: metadata.index,
        startTime: metadata.startTime,
        endTime: metadata.endTime || (metadata.startTime + metadata.duration),
        duration: metadata.duration,
        size: chunkBlob.size
      });
      
      totalProcessed++;
      
      // Update progress
      if (progressCallback) {
        const progress = (totalProcessed / chunkMetadata.length) * 100;
        progressCallback(progress, i + 1, chunkMetadata.length);
      }
    } catch (error) {
      console.error(`Error creating chunk ${i}:`, error);
      // Continue with other chunks even if one fails
    }
  }
  
  return chunks;
};

/**
 * Upload audio chunks to storage
 * @param projectId Project ID for storage path
 * @param chunks Array of audio chunks to upload
 * @param progressCallback Optional callback for tracking upload progress
 * @returns Promise with array of updated chunk metadata
 */
export const uploadAudioChunks = async (
  projectId: string,
  chunks: AudioChunk[],
  progressCallback?: (progress: number) => void
): Promise<AudioChunkMetadata[]> => {
  const uploadedChunks: AudioChunkMetadata[] = [];
  let totalUploaded = 0;
  
  if (!chunks.length) {
    console.warn("No chunks to upload");
    return [];
  }
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      // Format the file path for this chunk
      const fileName = `chunk_${chunk.index}_${Date.now()}.mp3`;
      const filePath = `projects/${projectId}/audio_chunks/${fileName}`;
      
      // Upload the chunk to storage
      const { data, error } = await supabase.storage
        .from('audio_chunks')
        .upload(filePath, chunk.blob, {
          contentType: 'audio/mp3',
          upsert: true
        });
        
      if (error) {
        console.error(`Error uploading chunk ${chunk.index}:`, error);
        uploadedChunks.push({
          index: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          duration: chunk.duration,
          audioPath: "", // No path since upload failed
          status: 'failed'
        });
      } else {
        uploadedChunks.push({
          index: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          duration: chunk.duration,
          audioPath: filePath,
          status: 'complete'
        });
      }
      
      // Update progress
      totalUploaded++;
      if (progressCallback) {
        const progress = (totalUploaded / chunks.length) * 100;
        progressCallback(progress);
      }
      
    } catch (error) {
      console.error(`Error processing chunk ${chunk.index}:`, error);
      uploadedChunks.push({
        index: chunk.index,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        duration: chunk.duration,
        audioPath: "", // No path since processing failed
        status: 'failed'
      });
    }
  }
  
  return uploadedChunks;
};
