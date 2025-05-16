
/**
 * Utility functions for managing upload progress tracking
 */

/**
 * Maps a percentage from one range to another
 * @param value Current percentage value (0-100)
 * @param sourceStart Start of source range
 * @param sourceEnd End of source range
 * @param targetStart Start of target range
 * @param targetEnd End of target range
 * @returns Mapped percentage in target range
 */
export const mapProgressRange = (
  value: number,
  sourceStart: number = 0,
  sourceEnd: number = 100,
  targetStart: number = 0,
  targetEnd: number = 100
): number => {
  // Ensure value is within source range
  const clampedValue = Math.max(sourceStart, Math.min(sourceEnd, value));
  
  // Calculate the percentage within the source range
  const percentage = (clampedValue - sourceStart) / (sourceEnd - sourceStart);
  
  // Map to target range and round to nearest integer
  return Math.round(targetStart + percentage * (targetEnd - targetStart));
};

/**
 * Creates a progress handler that maps progress from one range to another
 * @param onProgress Callback for progress updates
 * @param startPercent Start percentage in target range
 * @param endPercent End percentage in target range
 * @returns Function that can be called with source range progress (0-100)
 */
export const createProgressHandler = (
  onProgress: (progress: number, message?: string) => void,
  startPercent: number,
  endPercent: number
) => {
  return (progress: number, message?: string) => {
    const mappedProgress = mapProgressRange(
      progress,
      0,
      100,
      startPercent,
      endPercent
    );
    
    onProgress(mappedProgress, message);
  };
};

/**
 * Generates a human-readable message for an upload stage
 * @param stage Stage identifier
 * @param progress Current progress percentage
 * @returns User-friendly message
 */
export const getUploadStageMessage = (stage: string, progress?: number): string => {
  if (stage.startsWith("uploading") && progress) {
    return `Uploading: ${progress}%`;
  }
  
  switch (stage) {
    case "analyzing":
      return "Analyzing file...";
    case "preparing":
      return "Preparing file...";
    case "uploading":
      return "Uploading file...";
    case "processing":
      return "Processing file...";
    case "creating_project":
      return "Creating project...";
    case "chunking":
      return "Processing video segments...";
    case "preparing_chunks":
      return "Preparing video segments...";
    case "complete":
      return "Upload complete!";
    default:
      // Convert snake_case to Title Case with spaces
      return stage
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') + '...';
  }
};
