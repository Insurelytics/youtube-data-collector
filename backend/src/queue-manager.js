import { updateSyncJob, getNextPendingJob } from './storage.js';
import { syncChannelVideos as syncYouTubeVideos } from './youtube.js';
import { syncChannelReels as syncInstagramReels } from './instagram.js';
import { upsertChannel } from './storage.js';
import { performSmartScraping } from './scraping-orchestrator.js';

const MAX_SYNC_DAYS = 36500; // ~100 years

class QueueManager {
    constructor() {
        this.isProcessing = false;
        this.currentJobId = null;
        
        // Start processing queue immediately
        this.processQueue();
        
        // Check for new jobs every 5 seconds
        setInterval(() => {
            if (!this.isProcessing) {
                this.processQueue();
            }
        }, 5000);
    }

    async processQueue() {
        if (this.isProcessing) {
            return;
        }

        try {
            const nextJob = await getNextPendingJob();
            if (!nextJob) {
                return; // No pending jobs
            }

            await this.processJob(nextJob);
        } catch (error) {
            console.error('Error processing queue:', error);
        }
    }

    async processJob(job) {
        this.isProcessing = true;
        this.currentJobId = job.id;

        try {
            console.log(`Starting job ${job.id} for ${job.platform} channel ${job.handle}`);
            
            // Update job status to running
            updateSyncJob(job.id, { 
                status: 'running',
                started_at: new Date().toISOString()
            });

            // Get API key from environment
            const apiKey = process.env.API_KEY;
            if (!apiKey && job.platform === 'youtube') {
                throw new Error('Missing API_KEY environment variable for YouTube sync');
            }

            // Process the sync job
            let result;
            const sinceDays = job.since_days || MAX_SYNC_DAYS;
            
            if (job.platform === 'instagram') {
                result = await syncInstagramReels({ handle: job.handle, sinceDays });
            } else {
                // Default to YouTube
                result = await syncYouTubeVideos({ apiKey, handle: job.handle, sinceDays });
            }

            const { channelId, channelTitle, subscriberCount, thumbnailUrl, videos, reels, profileData } = result;
            const content = videos || reels || [];
            
            const channelData = { 
                id: channelId, 
                title: channelTitle, 
                handle: job.handle, 
                subscriberCount, 
                isActive: 1, 
                thumbnailUrl, 
                platform: job.platform 
            };
            
            // Add Instagram profile data if available
            if (profileData) {
                channelData.biography = profileData.biography;
                channelData.postsCount = profileData.postsCount;
                channelData.followsCount = profileData.followsCount;
                channelData.verified = profileData.verified ? 1 : 0;
                channelData.businessCategoryName = profileData.businessCategoryName;
                channelData.externalUrls = profileData.externalUrls ? JSON.stringify(profileData.externalUrls) : null;
            }
            
            // Store channel data
            upsertChannel(channelData);
            
            // Use smart scraping to handle new vs existing videos appropriately
            const scrapingResults = await performSmartScraping(content, job.platform);
            const { newVideos, updatedVideos } = scrapingResults;

            console.log(`Job ${job.id} completed successfully. Synced ${content.length} items for ${channelTitle}`);
            
            updateSyncJob(job.id, { 
                status: 'completed',
                completed_at: new Date().toISOString(),
                channel_id: channelId,
                channel_title: channelTitle,
                videos_found: content.length,
                videos_processed: content.length,
                new_videos: newVideos,
                updated_videos: updatedVideos
            });

        } catch (error) {
            console.error(`Job ${job.id} failed:`, error);
            
            updateSyncJob(job.id, { 
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: error.message
            });
        }

        this.cleanup();
        
        // Process next job after a short delay
        setTimeout(() => {
            this.processQueue();
        }, 1000);
    }

    cleanup() {
        this.isProcessing = false;
        this.currentJobId = null;
    }

    getCurrentJobId() {
        return this.currentJobId;
    }

    isCurrentlyProcessing() {
        return this.isProcessing;
    }
}

export default QueueManager;
