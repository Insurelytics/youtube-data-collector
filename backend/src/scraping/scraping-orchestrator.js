import { downloadImage, getLocalImageUrl } from '../video_processing/image-utils.js';
import { processVideo, getWordsFromAudio } from '../video_processing/video-utils.js';
import { upsertVideos, updateEngagementMetrics, getExistingVideoIds, extractAndAssociateHashtags } from '../database/storage.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initial scraping function - for new videos
 * Downloads images, processes topics/hashtags, and stores complete video data
 */
export async function performInitialScraping(videos, platform = 'youtube') {
  if (!videos || videos.length === 0) return { newVideos: 0, processedVideos: 0 };

  console.log(`Starting initial scraping for ${videos.length} new ${platform} videos...`);
  
  let processedCount = 0;
  let videosProcessed = 0;
  
  // For Instagram videos, download images
  if (platform === 'instagram') {
    for (const video of videos) {
      if (video.displayUrl) {
        const localImageUrl = await downloadImage(video.displayUrl, video.id);
        if (localImageUrl) {
          video.localImageUrl = localImageUrl;
          console.log(`Downloaded image for ${video.id}`);
        }
      }
      processedCount++;
    }
  }
  
  // Process videos (download, extract audio, filter silence, and transcribe)
  for (const video of videos) {
    try {
      if (video.videoUrl) {
        console.log(`Processing video ${video.id} for audio and transcription...`);
        const audioPath = await processVideo(video.videoUrl, video.id, platform);
        
        // Transcribe the filtered audio (usually better quality)
        let transcription = null;
        try {
          transcription = await getWordsFromAudio(audioPath);
          console.log(`Transcription completed for ${video.id}`);
        } catch (transcriptionError) {
          console.error(`Failed to transcribe video ${video.id}:`, transcriptionError.message);
        }
        
        video.transcription = transcription;        
        // Clean up audio files after transcription
        try {
          if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
            console.log(`Cleaned up original audio: ${audioPath}`);
          }
        } catch (cleanupError) {
          console.error(`Failed to clean up audio files for ${video.id}:`, cleanupError.message);
        }
        
        videosProcessed++;
      }
    } catch (error) {
      console.error(`Failed to process video ${video.id}:`, error);
      video.audioProcessing = { error: error.message };
      video.transcription = null;
      
      // Still try to clean up any audio files that might have been created
      try {
        const audioDir = path.join(__dirname, '../../temp/audio');
        const originalAudioPath = path.join(audioDir, `${video.id}_original.wav`);
        const filteredAudioPath = path.join(audioDir, `${video.id}_filtered.wav`);
        
        if (fs.existsSync(originalAudioPath)) {
          fs.unlinkSync(originalAudioPath);
          console.log(`Cleaned up original audio after error: ${originalAudioPath}`);
        }
        if (fs.existsSync(filteredAudioPath)) {
          fs.unlinkSync(filteredAudioPath);
          console.log(`Cleaned up filtered audio after error: ${filteredAudioPath}`);
        }
      } catch (cleanupError) {
        console.error(`Failed to clean up audio files after error for ${video.id}:`, cleanupError.message);
      }
    }
  }
  
  // Store all video data (includes engagement metrics)
  upsertVideos(videos);
  
  console.log(`Initial scraping completed: ${videos.length} new videos processed, ${processedCount} images downloaded, ${videosProcessed} videos processed`);
  
  return {
    newVideos: videos.length,
    processedVideos: videos.length,
    imagesDownloaded: processedCount,
    videosProcessed
  };
}

/**
 * Re-scraping function - for existing videos
 * Only updates engagement metrics (views, likes, comments)
 */
export async function performRescraping(videos, platform = 'youtube') {
  if (!videos || videos.length === 0) return { updatedVideos: 0 };

  console.log(`Starting re-scraping for ${videos.length} existing ${platform} videos (engagement metrics only)...`);
  
  // For existing Instagram videos, ensure they have local image URLs set
  if (platform === 'instagram') {
    for (const video of videos) {
      if (!video.localImageUrl) {
        const existingImageUrl = getLocalImageUrl(video.id);
        if (existingImageUrl) {
          video.localImageUrl = existingImageUrl;
        }
      }
    }
  }
  
  // Only update engagement metrics for existing videos
  updateEngagementMetrics(videos);
  
  console.log(`Re-scraping completed: ${videos.length} videos updated with latest engagement metrics`);
  
  return {
    updatedVideos: videos.length
  };
}

/**
 * Smart scraping orchestrator - determines which videos are new vs existing
 * and routes them to the appropriate scraping function
 */
export async function performSmartScraping(allVideos, platform = 'youtube') {
  if (!allVideos || allVideos.length === 0) {
    return { newVideos: 0, updatedVideos: 0, processedVideos: 0 };
  }

  console.log(`Starting smart scraping for ${allVideos.length} ${platform} videos...`);
  
  // Get list of video IDs that already exist in the database
  const allVideoIds = allVideos.map(v => v.id);
  const existingVideoIds = getExistingVideoIds(allVideoIds);
  const existingVideoIdsSet = new Set(existingVideoIds);
  
  // Separate new videos from existing videos
  const newVideos = allVideos.filter(video => !existingVideoIdsSet.has(video.id));
  const existingVideos = allVideos.filter(video => existingVideoIdsSet.has(video.id));
  
  console.log(`Found ${newVideos.length} new videos and ${existingVideos.length} existing videos to update`);
  
  // Perform initial scraping for new videos
  const initialResults = await performInitialScraping(newVideos, platform);
  
  // Perform re-scraping for existing videos
  const rescrapingResults = await performRescraping(existingVideos, platform);
  
  const totalResults = {
    newVideos: initialResults.newVideos,
    updatedVideos: rescrapingResults.updatedVideos,
    processedVideos: allVideos.length,
    imagesDownloaded: initialResults.imagesDownloaded || 0,
    videosProcessed: initialResults.videosProcessed || 0
  };
  
  console.log(`Smart scraping completed:`, totalResults);
  
  return totalResults;
}
