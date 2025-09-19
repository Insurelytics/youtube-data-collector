import { ensureDatabase } from './connection.js';
import { initChannelsSchema } from './channels.js';
import { initVideosSchema } from './videos.js';
import { initJobsSchema } from './jobs.js';
import { initTopicsSchema } from './topics.js';
import { initSettingsSchema } from './settings.js';
import { initSuggestedChannelsSchema } from './suggested-channels.js';

// Re-export all functions from individual modules
export { ensureDatabase } from './connection.js';

// Channel functions
export {
  upsertChannel,
  listChannels,
  removeChannel,
  getChannel,
  getChannelTrends,
  getLastPublishedDate
} from './channels.js';

// Video functions
export {
  upsertVideos as _upsertVideos,
  queryVideos,
  queryVideosAdvanced,
  getTopVideos,
  getTimeFilteredAvgViews,
  getSpecialVideos,
  getViralVideoCount,
  getAllVideos,
  getNewVideosSince,
  identifyViralVideos,
  videoExists,
  getExistingVideoIds,
  updateEngagementMetrics,
  getVideosNeedingAudioProcessing,
  getVideosNeedingTranscription,
  updateAudioProcessingStatus,
  updateTranscriptionStatus
} from './videos.js';

// Import private video functions
import { upsertVideos as _upsertVideosInternal } from './videos.js';
import { extractAndAssociateHashtags } from './topics.js';

// Wrapper function that handles both video insertion and hashtag extraction
export function upsertVideos(videos) {
  _upsertVideosInternal(videos);
  // Extract and associate hashtags after inserting/updating videos
  for (const video of videos) {
    extractAndAssociateHashtags(video.id, video.description);
  }
}

// Job functions
export {
  createSyncJob,
  updateSyncJob,
  getNextPendingJob,
  getJobStatus,
  listJobs,
  cleanupOrphanedRunningJobs
} from './jobs.js';

// Topic functions
export {
  upsertTopic,
  associateVideoWithTopics,
  extractAndAssociateHashtags,
  associateAITopicsWithVideo,
  getVideoTopics,
  hasAITopics,
  removeAITopics,
  getTopicStats,
  getVideosByTopic,
  getVideosNeedingAITopics,
  getVideoTopicsSummary,
  getAllTopics,
  getAllVideoTopics
} from './topics.js';

// Settings functions
export {
  getSetting,
  setSetting,
  getSettings
} from './settings.js';

// Suggested channels functions
export {
  upsertSuggestedChannel,
  listSuggestedChannels,
  getSuggestedChannelsBySearchTerm,
  removeSuggestedChannel,
  isChannelAlreadyTracked
} from './suggested-channels.js';

// Initialize all database schemas
export function initializeDatabase() {
  ensureDatabase();
  initChannelsSchema();
  initVideosSchema();
  initJobsSchema();
  initTopicsSchema();
  initSettingsSchema();
  initSuggestedChannelsSchema();
  console.log('Database initialized with all schemas');
}
