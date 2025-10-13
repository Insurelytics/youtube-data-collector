import { downloadImage, getLocalImageUrl } from '../video_processing/image-utils.js';
import { downloadAndExtractAudio, transcribeStoredAudio, processVideo, getWordsFromAudio } from '../video_processing/video-utils.js';
import { upsertVideos, updateEngagementMetrics, getExistingVideoIds, extractAndAssociateHashtags, associateAITopicsWithVideo, updateAudioProcessingStatus, updateTranscriptionStatus, getVideosNeedingAudioProcessing, getVideosNeedingTranscription } from '../database/index.js';
import { inferTopicsFromTranscription } from '../topics/inferTopics.js';
import { batchTranscribe, batchInferTopics } from '../utils/batch-processor.js';
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
  
  // Store videos first (without audio processing)
  upsertVideos(videos);
  
  // Phase 1: Download videos and extract audio
  const videosWithAudio = videos.filter(v => v.videoUrl);
  
  for (let i = 0; i < videosWithAudio.length; i++) {
    const video = videosWithAudio[i];
    try {
      if (progressCallback) {
        progressCallback('Downloading and extracting audio', i + 1, videosWithAudio.length);
      }
      
      console.log(`Downloading and extracting audio for ${video.id}...`);
      const audioPath = await downloadAndExtractAudio(video.videoUrl, video.id, platform);
      
      // Update database with audio path
      updateAudioProcessingStatus(video.id, audioPath, 'audio_ready');
      // Keep path in memory for immediate transcription phase
      video.audioPath = audioPath;
      console.log(`Audio processing completed for ${video.id}: ${audioPath}`);
      
      videosProcessed++;
    } catch (error) {
      console.error(`Failed to process audio for video ${video.id}:`, error);
      
      // Handle videos with no audio stream specifically
      if (error.message.includes('Video has no audio stream')) {
        updateAudioProcessingStatus(video.id, null, 'no_audio');
        console.log(`Video ${video.id} has no audio stream - skipping audio processing`);
      } else {
        updateAudioProcessingStatus(video.id, null, 'audio_failed');
      }
    }
  }
  
  // Phase 2: Transcribe stored audio files in batches
  const videosForTranscription = videosWithAudio.filter(v => v.videoUrl); // All videos that had audio
  
  if (videosForTranscription.length > 0) {
    // Prepare audio items for batch processing
    const audioItems = [];
    
    for (const video of videosForTranscription) {
      const audioPath = video.audioPath;
      if (audioPath && fs.existsSync(audioPath)) {
        audioItems.push({ audioPath, videoId: video.id });
      } else {
        console.warn(`Audio file not found for ${video.id}, skipping transcription`);
        updateTranscriptionStatus(video.id, null, 'audio_missing');
      }
    }
    
    if (audioItems.length > 0) {
      // Process transcriptions in batches
      const transcriptionResults = await batchTranscribe(
        audioItems,
        getWordsFromAudio,
        progressCallback ? (current, total) => progressCallback('Transcribing audio', current, total) : null
      );
      
      // Update database and video objects with results
      transcriptionResults.forEach((result, index) => {
        if (result) {
          const { videoId, transcription } = result;
          const video = videosForTranscription.find(v => v.id === videoId);
          
          if (video) {
            updateTranscriptionStatus(videoId, transcription, 'completed');
            video.transcription = transcription; // Keep in memory for topic inference
          }
        } else {
          // Failed transcription
          const { videoId } = audioItems[index];
          const video = videosForTranscription.find(v => v.id === videoId);
          
          if (video) {
            updateTranscriptionStatus(videoId, null, 'transcription_failed');
            video.transcription = null;
          }
        }
      });
    }
  }
  
  // Infer topics for videos with transcriptions in batches
  const videosWithTranscriptions = videos.filter(v => v.transcription);
  if (videosWithTranscriptions.length > 0) {
    // Prepare video items for batch topic inference
    const videoItems = videosWithTranscriptions.map(video => ({
      transcription: video.transcription,
      title: video.title || '',
      description: video.description || '',
      videoId: video.id,
      platform
    }));
    
    // Process topic inference in batches
    const topicResults = await batchInferTopics(
      videoItems,
      inferTopicsFromTranscription,
      progressCallback ? (current, total) => progressCallback('Inferring video topics', current, total) : null
    );
    
    // Update video objects with results
    topicResults.forEach((result, index) => {
      const video = videosWithTranscriptions[index];
      
      if (result && result.topics) {
        const { topics } = result;
        
        if (topics && topics.length > 0) {
          console.log(`Inferred ${topics.length} topics for ${video.id}:`, topics);
        } else {
          console.log(`No topics could be inferred for video ${video.id}`);
        }
        
        video.inferredTopics = topics;
      } else {
        console.error(`Failed to infer topics for video ${video.id}`);
        video.inferredTopics = [];
      }
    });
  }
  
  // Update videos with final state (transcriptions were already updated in database)
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

/**
 * Process pending audio downloads for videos that need it
 */
export async function processAudioDownloads(progressCallback = null) {
  console.log('Starting audio download processing...');
  
  const videosNeedingAudio = getVideosNeedingAudioProcessing();
  
  if (videosNeedingAudio.length === 0) {
    console.log('No videos need audio processing');
    return { processed: 0 };
  }
  
  console.log(`Found ${videosNeedingAudio.length} videos needing audio processing`);
  let processed = 0;
  
  for (let i = 0; i < videosNeedingAudio.length; i++) {
    const video = videosNeedingAudio[i];
    
    try {
      if (progressCallback) {
        progressCallback('Downloading and extracting audio', i + 1, videosNeedingAudio.length);
      }
      
      console.log(`Processing audio for ${video.id}...`);
      const audioPath = await downloadAndExtractAudio(video.videoUrl, video.id, video.platform);
      
      updateAudioProcessingStatus(video.id, audioPath, 'audio_ready');
      console.log(`Audio processing completed for ${video.id}: ${audioPath}`);
      processed++;
      
    } catch (error) {
      console.error(`Failed to process audio for video ${video.id}:`, error);
      
      // Handle videos with no audio stream specifically
      if (error.message.includes('Video has no audio stream')) {
        updateAudioProcessingStatus(video.id, null, 'no_audio');
        console.log(`Video ${video.id} has no audio stream - skipping audio processing`);
      } else {
        updateAudioProcessingStatus(video.id, null, 'audio_failed');
      }
    }
  }
  
  console.log(`Audio download processing completed: ${processed}/${videosNeedingAudio.length} videos processed`);
  return { processed, total: videosNeedingAudio.length };
}

/**
 * Process pending transcriptions for videos that have audio ready
 */
export async function processTranscriptions(progressCallback = null) {
  console.log('Starting transcription processing...');
  
  const videosNeedingTranscription = getVideosNeedingTranscription();
  
  if (videosNeedingTranscription.length === 0) {
    console.log('No videos need transcription');
    return { processed: 0 };
  }
  
  console.log(`Found ${videosNeedingTranscription.length} videos needing transcription`);
  
  // Prepare audio items for batch processing, filtering out missing files
  const audioItems = [];
  for (const video of videosNeedingTranscription) {
    if (!fs.existsSync(video.audioPath)) {
      console.warn(`Audio file not found for ${video.id}: ${video.audioPath}`);
      updateTranscriptionStatus(video.id, null, 'audio_missing');
    } else {
      audioItems.push({ audioPath: video.audioPath, videoId: video.id });
    }
  }
  
  if (audioItems.length === 0) {
    console.log('No audio files available for transcription');
    return { processed: 0, total: videosNeedingTranscription.length };
  }
  
  // Process transcriptions in batches
  const transcriptionResults = await batchTranscribe(
    audioItems,
    getWordsFromAudio,
    progressCallback ? (current, total) => progressCallback('Transcribing audio', current, total) : null
  );
  
  // Update database with results
  let processed = 0;
  transcriptionResults.forEach((result, index) => {
    if (result) {
      const { videoId, transcription } = result;
      updateTranscriptionStatus(videoId, transcription, 'completed');
      processed++;
    } else {
      // Failed transcription
      const { videoId } = audioItems[index];
      updateTranscriptionStatus(videoId, null, 'transcription_failed');
    }
  });
  
  console.log(`Transcription processing completed: ${processed}/${videosNeedingTranscription.length} videos processed`);
  return { processed, total: videosNeedingTranscription.length };
}
