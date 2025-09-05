import { downloadImage, getLocalImageUrl } from './image-utils.js';
import { upsertVideos, updateEngagementMetrics, getExistingVideoIds, extractAndAssociateHashtags } from './storage.js';

/**
 * Initial scraping function - for new videos
 * Downloads images, processes topics/hashtags, and stores complete video data
 */
export async function performInitialScraping(videos, platform = 'youtube') {
  if (!videos || videos.length === 0) return { newVideos: 0, processedVideos: 0 };

  console.log(`Starting initial scraping for ${videos.length} new ${platform} videos...`);
  
  let processedCount = 0;
  
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
  
  // Store all video data (includes engagement metrics)
  upsertVideos(videos);
  
  console.log(`Initial scraping completed: ${videos.length} new videos processed, ${processedCount} images downloaded`);
  
  return {
    newVideos: videos.length,
    processedVideos: videos.length,
    imagesDownloaded: processedCount
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
    imagesDownloaded: initialResults.imagesDownloaded || 0
  };
  
  console.log(`Smart scraping completed:`, totalResults);
  
  return totalResults;
}
