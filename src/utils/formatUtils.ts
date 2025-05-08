/**
 * Format a file size from bytes to human readable format
 * @param bytes File size in bytes
 * @returns Formatted string (e.g. "2.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format duration in seconds to human readable format
 * @param seconds Duration in seconds
 * @returns Formatted string (e.g. "1:23:45")
 */
export const formatDuration = (seconds: number): string => {
  if (!seconds) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  // Format: HH:MM:SS or MM:SS if no hours
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
};

/**
 * Convert a timestamp string to seconds
 * @param timestamp Timestamp string in format "HH:MM:SS" or "MM:SS"
 * @returns Number of seconds
 */
export const timestampToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(':').map(part => parseInt(part, 10));
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  
  return 0;
};

/**
 * Format a date string to a human readable format
 * @param dateString Date string
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};
