import { downloadImage, getLocalImageUrl } from '../video_processing/image-utils.js';
import { processVideo, getWordsFromAudio } from '../video_processing/video-utils.js';
import { upsertVideos, updateEngagementMetrics, getExistingVideoIds, extractAndAssociateHashtags, associateAITopicsWithVideo } from '../database/index.js';
import { inferTopicsFromTranscription } from '../topics/inferTopics.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initial scraping function - for new videos
 * Downloads images, processes topics/hashtags, and stores complete video data
 */
export async function performInitialScraping(videos, platform, progressCallback = null) {
  if (!videos || videos.length === 0) return { newVideos: 0, processedVideos: 0 };

  console.log(`Starting initial scraping for ${videos.length} new ${platform} videos...`);
  
  let processedCount = 0;
  let videosProcessed = 0;
  
  // For Instagram videos, download images
  if (platform === 'instagram') {
    if (progressCallback) progressCallback('Downloading video images');
    
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
  const videosWithAudio = videos.filter(v => v.videoUrl);
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    try {
      if (video.videoUrl) {
        // Update progress for transcription step
        if (progressCallback) {
          progressCallback('Transcribing audio', videosProcessed + 1, videosWithAudio.length);
        }
        
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
  
  // Infer topics for videos with transcriptions
  const videosWithTranscriptions = videos.filter(v => v.transcription);
  if (videosWithTranscriptions.length > 0) {
    for (let i = 0; i < videosWithTranscriptions.length; i++) {
      const video = videosWithTranscriptions[i];
      try {
        if (progressCallback) {
          progressCallback('Inferring video topics', i + 1, videosWithTranscriptions.length);
        }
        
        console.log(`Inferring topics for video ${video.id}...`);
        const inferredHashtags = await inferTopicsFromTranscription(
          video.transcription, 
          video.title || '', 
          video.description || '', 
          platform
        );
        
        if (inferredHashtags && inferredHashtags.length > 0) {
          console.log(`Inferred ${inferredHashtags.length} topics for ${video.id}:`, inferredHashtags);
        } else {
          console.log(`No topics could be inferred for video ${video.id}`);
        }
        
        video.inferredTopics = inferredHashtags;
      } catch (error) {
        console.error(`Failed to infer topics for video ${video.id}:`, error.message);
        video.inferredTopics = [];
      }
    }
  }
  
  // Store all video data (includes engagement metrics)
  upsertVideos(videos);
  
  // Associate inferred topics after videos are stored
  for (const video of videos) {
    if (video.inferredTopics && video.inferredTopics.length > 0) {
      try {
        associateAITopicsWithVideo(video.id, video.inferredTopics);
        console.log(`Associated ${video.inferredTopics.length} AI-generated topics with video ${video.id}`);
      } catch (error) {
        console.error(`Failed to associate AI topics for video ${video.id}:`, error.message);
      }
    }
  }
  
  const topicsInferred = videos.filter(v => v.inferredTopics && v.inferredTopics.length > 0).length;
  
  console.log(`Initial scraping completed: ${videos.length} new videos processed, ${processedCount} images downloaded, ${videosProcessed} videos processed, ${topicsInferred} videos with inferred topics`);
  
  return {
    newVideos: videos.length,
    processedVideos: videos.length,
    imagesDownloaded: processedCount,
    videosProcessed,
    topicsInferred
  };
}

/**
 * Re-scraping function - for existing videos
 * Only updates engagement metrics (views, likes, comments)
 */
export async function performRescraping(videos, platform, progressCallback = null) {
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
export async function performSmartScraping(allVideos, platform, progressCallback = null) {
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
  const initialResults = await performInitialScraping(newVideos, platform, progressCallback);
  
  // Perform re-scraping for existing videos (lightweight update)
  if (progressCallback) progressCallback('Updating engagement metrics');
  const rescrapingResults = await performRescraping(existingVideos, platform, progressCallback);
  
  const totalResults = {
    newVideos: initialResults.newVideos,
    updatedVideos: rescrapingResults.updatedVideos,
    processedVideos: allVideos.length,
    imagesDownloaded: initialResults.imagesDownloaded || 0,
    videosProcessed: initialResults.videosProcessed || 0,
    topicsInferred: initialResults.topicsInferred || 0
  };
  
  console.log(`Smart scraping completed:`, totalResults);
  
  return totalResults;
}
