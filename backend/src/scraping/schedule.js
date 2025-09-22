// Schedule management for YouTube Data Collector
// Follows the same pattern as the example project
// All scheduling operations use UTC time for consistency across timezones

// Note: Scheduler is not currently in use; keeping code for potential future re-enable
import cron from 'node-cron';
import { listChannels, createSyncJob, getJobStatus, getSetting, setSetting, getNewVideosSince, identifyViralVideos } from '../database/index.js';
import { sendViralVideosEmail } from '../email/email.js';

function getScheduledHour() {
    const scheduleSettingsStr = getSetting('scheduleSettings');
    if (scheduleSettingsStr) {
        try {
            const scheduleSettings = JSON.parse(scheduleSettingsStr);
            if (scheduleSettings.sendTime) {
                const [hour] = scheduleSettings.sendTime.split(':');
                return parseInt(hour) || 4;
            }
        } catch (e) {
            console.warn('Failed to parse schedule settings for sendTime:', e);
        }
    }
    return process.env.SCHEDULED_HOUR ? parseInt(process.env.SCHEDULED_HOUR) : 4; // Default 4 AM UTC
}

let isJobRunning = false; // Lock to prevent concurrent job execution

async function getCurrentDate() {
    if (process.env.TEST_DATE) {
        return new Date(process.env.TEST_DATE);
    }
    return new Date();
}


async function waitForJobsToComplete(jobIds, maxWaitHours = 1) {
    const checkInterval = 3000; // Check every 3 seconds
    const maxWaitTime = maxWaitHours * 60 * 60 * 1000; // Max wait time
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        const jobStatuses = await Promise.all(
            jobIds.map(jobId => getJobStatus(jobId))
        );
        
        const pendingOrRunning = jobStatuses.filter(job => 
            job && (job.status === 'pending' || job.status === 'running')
        );
        
        if (pendingOrRunning.length === 0) {
            console.log('All jobs completed');
            return jobStatuses;
        }
        
        console.log(`Waiting for ${pendingOrRunning.length} jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error('Jobs did not complete within maximum wait time');
}

async function processAllJobs() {
    const channels = listChannels().filter(ch => ch.isActive);
    const jobIds = [];
    
    if (channels.length === 0) {
        console.log('No active channels found, skipping...');
        // TODO: In the future, send email notification about no active channels
        return;
    }
    
    console.log(`Creating sync jobs for ${channels.length} active channels...`);
    
    // Record the start time to identify new videos from this sync
    const syncStartTime = new Date().toISOString();
    
    // Update lastJobRun immediately to prevent duplicate job creation
    setSetting('lastJobRun', syncStartTime);
    
    for (const channel of channels) {
        const jobId = createSyncJob({ 
            handle: channel.handle, 
            platform: channel.platform,
            sinceDays: 7 // Sync last week's content for scheduled jobs
        });
        jobIds.push(jobId);
        console.log(`Created job for ${channel.title} (${channel.handle}) with ID: ${jobId}`);
    }
    
    console.log(`Created ${jobIds.length} jobs, waiting for completion...`);
    
    try {
        const jobResults = await waitForJobsToComplete(jobIds, 4); // wait up to 4 hours for all sync jobs to complete
        console.log("All scheduled sync jobs completed successfully");
        
        // Send email notifications with sync results
        await sendSyncResultsEmail(syncStartTime, jobResults);
        
    } catch (error) {
        console.error('Error waiting for scheduled jobs to complete:', error);
        // TODO: In the future, send email to admin warning about sync issues
        throw error;
    }
}

async function sendSyncResultsEmail(syncStartTime, jobResults) {
    try {
        // Check if email notifications are enabled
        const scheduleSettingsStr = getSetting('scheduleSettings');
        let emailNotificationsEnabled = false;
        
        if (scheduleSettingsStr) {
            try {
                const scheduleSettings = JSON.parse(scheduleSettingsStr);
                emailNotificationsEnabled = scheduleSettings.emailNotifications || false;
            } catch (e) {
                console.warn('Failed to parse schedule settings for email notifications:', e);
            }
        }
        
        if (!emailNotificationsEnabled) {
            console.log('Email notifications are disabled, skipping email...');
            return;
        }
        
        // Get all videos added since the sync started
        const newVideos = getNewVideosSince(syncStartTime);
        console.log(`Found ${newVideos.length} new videos from recent sync`);
        
        if (newVideos.length === 0) {
            console.log('No new videos found, skipping email...');
            return;
        }
        
        // Get viral settings from settings or use defaults
        let viralMultiplier = 5;
        let viralMethod = 'subscribers';
        try {
            const globalCriteria = getSetting('globalCriteria');
            if (globalCriteria) {
                const criteria = JSON.parse(globalCriteria);
                viralMultiplier = criteria.viralMultiplier || 5;
                if (criteria.viralMethod === 'avgViews' || criteria.viralMethod === 'subscribers') {
                    viralMethod = criteria.viralMethod;
                }
            }
        } catch (e) {
            console.warn('Failed to parse viral multiplier from settings, using default:', e);
        }
        
        // Identify viral videos
        const viralVideos = identifyViralVideos(newVideos, viralMultiplier, viralMethod);
        console.log(`Identified ${viralVideos.length} viral videos`);
        
        // Send email notification
        await sendViralVideosEmail(viralVideos, newVideos.length, jobResults);
        
    } catch (error) {
        console.error('Error sending sync results email:', error);
        // Don't throw here - we don't want email failures to break the sync process
    }
}

async function shouldRunJob() {
    // Read settings from database with fallback to environment variables
    const scheduleSettingsStr = getSetting('scheduleSettings');
    let scheduleSettings = {};
    
    if (scheduleSettingsStr) {
        try {
            scheduleSettings = JSON.parse(scheduleSettingsStr);
        } catch (e) {
            console.warn('Failed to parse schedule settings:', e);
        }
    }
    
    // Get settings with fallbacks
    const enableScheduling = scheduleSettings.emailNotifications || process.env.ENABLE_SCHEDULING === 'true';
    const frequency = scheduleSettings.scrapeFrequency || process.env.SCHEDULE_FREQUENCY || 'daily';
    const lastJobRunStr = process.env.LAST_JOB_RUN || getSetting('lastJobRun'); // ISO string
    console.log('lastJobRunStr', lastJobRunStr);
    
    if (!enableScheduling) {
        return false;
    }
    
    if (!lastJobRunStr) {
        console.log('No lastJobRun found, running now');
        return true;
    }
    
    const lastJobRunDate = new Date(lastJobRunStr);
    const now = await getCurrentDate();
    
    if (frequency === 'daily') {
        // Check if it's the following day and after scheduled hour (using UTC for consistency)
        const isNextDay = now.getUTCDate() !== lastJobRunDate.getUTCDate() || 
                         now.getUTCMonth() !== lastJobRunDate.getUTCMonth() || 
                         now.getUTCFullYear() !== lastJobRunDate.getUTCFullYear();
        const isAfterScheduledHour = now.getUTCHours() >= getScheduledHour();
        
        if (isNextDay && isAfterScheduledHour) {
            return true;
        } else {
            return false;
        }
    }
    
    if (frequency === '2days') {
        // Check if at least 2 days have passed since last run
        const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
        const timeSinceLastRun = now.getTime() - lastJobRunDate.getTime();
        const hasBeenTwoDays = timeSinceLastRun >= twoDaysInMs;
        const isAfterScheduledHour = now.getUTCHours() >= getScheduledHour();
        
        if (hasBeenTwoDays && isAfterScheduledHour) {
            return true;
        } else {
            return false;
        }
    }
    
    if (frequency === 'weekly') {
        const weeklyDay = parseInt(process.env.SCHEDULE_WEEKLY_DAY || '0'); // 0 = Sunday
        
        // Check if it's the correct day of week and after scheduled hour (using UTC)
        const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        const isCorrectDay = currentDay === weeklyDay;
        const isAfterScheduledHour = now.getUTCHours() >= getScheduledHour();
        
        // Check if at least a week has passed since last run
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        const timeSinceLastRun = now.getTime() - lastJobRunDate.getTime();
        const hasBeenAWeek = timeSinceLastRun >= weekInMs;
        
        if (isCorrectDay && isAfterScheduledHour && hasBeenAWeek) {
            return true;
        } else {
            return false;
        }
    }
    
    if (frequency === 'monthly') {
        const monthlyDay = parseInt(process.env.SCHEDULE_MONTHLY_DAY || '1'); // 1st of month
        
        // Check if it's the correct day of month and after scheduled hour (using UTC)
        const currentDate = now.getUTCDate();
        const isCorrectDate = currentDate === monthlyDay;
        const isAfterScheduledHour = now.getUTCHours() >= getScheduledHour();
        
        // Check if at least a month has passed since last run
        const lastRunMonth = lastJobRunDate.getUTCMonth();
        const lastRunYear = lastJobRunDate.getUTCFullYear();
        const currentMonth = now.getUTCMonth();
        const currentYear = now.getUTCFullYear();
        
        const hasBeenAMonth = (currentYear > lastRunYear) || 
                             (currentYear === lastRunYear && currentMonth > lastRunMonth);
        
        if (isCorrectDate && isAfterScheduledHour && hasBeenAMonth) {
            return true;
        } else {
            return false;
        }
    }
    
    console.log('Invalid frequency:', frequency);
    return false;
}

async function safeRunJob() {
    // Prevent concurrent job execution to avoid complex errors and race conditions
    if (isJobRunning) {
        console.log('Scheduled job is already running, skipping...');
        return;
    }
    
    isJobRunning = true;
    console.log('Starting scheduled sync job...');
    
    try {
        const shouldRun = await shouldRunJob();
        if (shouldRun) {
            await processAllJobs();
            console.log('Scheduled sync job completed successfully');
        } else {
            // Uncomment for debugging: console.log('Scheduled job not needed at this time');
        }
    } catch (error) {
        console.error('Error during scheduled job execution:', error);
    } finally {
        isJobRunning = false;
    }
}

async function initScheduler() {
    console.log('Initializing scheduler...');
    
    // Run once on server start (only if enabled)
    await safeRunJob();
    
    // Run every 5 minutes to check if a scheduled job should run
    cron.schedule('*/5 * * * *', async () => {
        await safeRunJob();
    });
    
    console.log('Scheduler initialized');
}

// Export for manual triggering (useful for testing or admin actions)
export async function triggerScheduledSync() {
    if (isJobRunning) {
        throw new Error('A scheduled sync job is already running');
    }
    
    console.log('Manually triggering scheduled sync...');
    await processAllJobs();
}

// Export kept for compatibility, but currently not used
export { initScheduler };
