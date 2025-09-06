import { updateSyncJob, getNextPendingJob, upsertChannel } from '../database/index.js';
import { syncChannelVideos as syncYouTubeVideos } from './youtube.js';
import { syncChannelReels as syncInstagramReels } from './instagram.js';
import { performSmartScraping } from './scraping-orchestrator.js';

const MAX_SYNC_DAYS = 36500; // ~100 years

class QueueManager {
    constructor() {
        this.isProcessing = false;
        this.currentJobId = null;
        // In-memory progress tracking
        this.jobProgress = new Map(); // jobId -> { currentStep, progressCurrent, progressTotal }
        
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

            // Initialize progress tracking
            this.updateJobProgress(job.id, 'Getting channel info');

            // Get API key from environment
            const apiKey = process.env.API_KEY;
            if (!apiKey && job.platform === 'youtube') {
                throw new Error('Missing API_KEY environment variable for YouTube sync');
            }

            // STEP 1: Get channel info first and store it immediately
            let channelInfo;
            if (job.platform === 'instagram') {
                const { getChannelByHandle } = await import('./instagram.js');
                channelInfo = await getChannelByHandle({ handle: job.handle });
            } else {
                const { getChannelByHandle } = await import('./youtube.js');
                channelInfo = await getChannelByHandle({ apiKey, handle: job.handle });
            }

            const { channelId, channelTitle, subscriberCount, thumbnailUrl, profileData } = channelInfo;
            
            const channelData = { 
                id: channelId, 
                title: channelTitle, 
                handle: job.handle, 
                subscriberCount, 
                isActive: 1, 
                thumbnailUrl, 
                platform: job.platform,
                initial_scrape_running: 1
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
            
            // Store channel data immediately so it shows up in frontend
            upsertChannel(channelData);
            console.log(`Channel ${channelTitle} stored in database, will now begin content scraping...`);

            // STEP 2: Now perform the content scraping
            this.updateJobProgress(job.id, 'Scraping video info');
            
            let result;
            const sinceDays = job.since_days || MAX_SYNC_DAYS;
            
            if (job.platform === 'instagram') {
                result = await syncInstagramReels({ handle: job.handle, sinceDays });
            } else {
                // Default to YouTube
                result = await syncYouTubeVideos({ apiKey, handle: job.handle, sinceDays });
            }

            const { videos, reels } = result;
            const content = videos || reels || [];
            
            // STEP 3: Use smart scraping to handle new vs existing videos appropriately
            this.updateJobProgress(job.id, 'Processing videos');
            
            const scrapingResults = await performSmartScraping(content, job.platform, (step, current, total) => {
                this.updateJobProgress(job.id, step, current, total);
            });
            const { newVideos, updatedVideos, topicsInferred } = scrapingResults;

            console.log(`Job ${job.id} completed successfully. Synced ${content.length} items for ${channelTitle}`);
            
            // Mark initial scrape as completed
            upsertChannel({ id: channelId, title: channelTitle, handle: job.handle, platform: job.platform, initial_scrape_running: 0 });
            
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
        if (this.currentJobId) {
            this.jobProgress.delete(this.currentJobId);
        }
        this.currentJobId = null;
    }

    // Methods to track and retrieve job progress
    updateJobProgress(jobId, step, current = null, total = null) {
        this.jobProgress.set(jobId, {
            currentStep: step,
            progressCurrent: current,
            progressTotal: total
        });
    }

    getJobProgress(jobId) {
        return this.jobProgress.get(jobId) || null;
    }

    getCurrentJobId() {
        return this.currentJobId;
    }

    isCurrentlyProcessing() {
        return this.isProcessing;
    }
}

export default QueueManager;
