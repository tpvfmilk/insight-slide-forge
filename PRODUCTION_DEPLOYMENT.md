
# Production Deployment Guide

## Current Implementation Status

The current video transcription system has been implemented with "virtual chunking" which only creates metadata references to segments of the video but doesn't actually split the files. This implementation fails with the OpenAI Whisper API because the whole video file exceeds the 25MB size limit.

## Required Production Infrastructure

To properly implement video chunking and transcription in production, follow these steps:

### 1. Set up Video Processing Server

You'll need a dedicated server with FFmpeg installed to handle video processing tasks:

- **Recommended specs**: 
  - 4+ CPU cores
  - 8GB+ RAM
  - 100GB+ storage
  - Ubuntu 20.04 or later

- **Install requirements**:
```bash
sudo apt update
sudo apt install -y ffmpeg python3-pip
pip3 install flask gunicorn
```

- **Create a simple API service** for video processing:
  - Implement endpoints for downloading videos from Supabase
  - Use FFmpeg to split videos into chunks and extract audio
  - Upload processed chunks back to Supabase

### 2. Audio Extraction for Whisper API

Audio extraction is crucial for efficient transcription:

- Video files are large (80MB+) and exceed Whisper API limits
- Audio-only files are typically 5-10% the size of video files
- Extract audio with FFmpeg:
```bash
ffmpeg -i input_video.mp4 -vn -acodec libmp3lame -q:a 4 output_audio.mp3
```

### 3. Production Storage Structure

Organize your Supabase storage with these buckets:

- `video_uploads/` - Original video uploads
- `chunks/` - Processed video chunks
- `audio_extracts/` - Extracted audio for transcription
- `slide_stills/` - Frame captures for slides

### 4. Edge Function Updates

The edge functions have been prepared with placeholders for production:

- `transcribe-video` - Updated to handle real audio chunks
- `video-chunker` - Needs to call the external FFmpeg service
- `extract-audio` - Needs to call the external FFmpeg service
- `create-storage-buckets` - Ensures storage structure is properly set up

### 5. Frame Extraction Service

For slide generation, implement frame extraction:

```bash
# Extract frame at specific timestamp
ffmpeg -i video.mp4 -ss 00:01:23 -frames:v 1 frame.jpg
```

### 6. Authentication & Security

Ensure proper security between services:

1. Create API keys for service-to-service authentication
2. Set up CORS properly for your production domain
3. Implement proper error handling and rate limiting

## Deployment Steps

1. **Deploy the FFmpeg processing server**:
   - Set up on AWS EC2, Google Compute Engine, or Digital Ocean
   - Configure network security to allow connections from your Supabase instance
   - Install FFmpeg and create API endpoints

2. **Update Supabase Edge Functions**:
   - Modify functions to call your processing server
   - Set environment variables with service authentication details

3. **Test the system**:
   - Upload a test video and check if chunking works
   - Verify audio extraction reduces file size below Whisper limits
   - Test transcription quality with audio-only files

4. **Monitor and optimize**:
   - Track processing times and optimize bottlenecks
   - Implement caching for common operations
   - Add retries for network failures

## Current Limitations

The current implementation has these limitations that need to be addressed in production:

1. Edge Functions cannot use FFmpeg directly
2. Virtual chunking doesn't actually split files
3. Sending whole video files to Whisper API fails with "Payload Too Large" errors
4. The system needs a dedicated server for FFmpeg processing

## Support

For technical support with your production deployment, contact the development team.
