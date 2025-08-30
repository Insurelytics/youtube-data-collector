// Uses cron jobs to rescrape and have mail sent at a certain time

const cron = require('node-cron');
const { sendLeadsEmail, sendScheduledLeadsEmail } = require('./send-mail');
const { getEmailSettings, updateEmailSettings, updateLastJobRun } = require('../database/email-settings');
const { getEnabledCounties } = require('../database/counties');
const { getProjectsByCategory, getProjectScrapedAfter } = require('../database/projects');
const { createScrapingJob, getJobStatus } = require('../database/jobs');

const SCHEDULED_HOUR = process.env.SCHEDULED_HOUR ? parseInt(process.env.SCHEDULED_HOUR) : 4; // Default 4 AM

let isJobRunning = false; // Lock to prevent concurrent job execution

async function getCurrentDate() {
    if (process.env.TEST_DATE) {
        return new Date(process.env.TEST_DATE);
    }
    return new Date();
}

async function filterProjectsByLeadType(projects, leadType) {
    // Filter projects based on the configured lead type preference
    const { categorizeProject } = require('../database/projects');
    const validLeadTypes = ['strongLeads', 'weakLeads', 'watchlist', 'both'];
    
    if (!validLeadTypes.includes(leadType)) {
        console.log(`Invalid lead type: ${leadType}, defaulting to strongLeads`);
        leadType = 'strongLeads';
    }
    
    try {
        const qualifiedProjects = [];
        
        for (const project of projects) {
            try {
                // Categorize the project using the same logic as the database
                const { category } = await categorizeProject(project);
                
                // Include projects that match the requested category or are "better"
                // For example, if requesting weakLeads, include both strongLeads and weakLeads
                const includeProject = 
                    (leadType === 'strongLeads' && category === 'strongLeads') ||
                    (leadType === 'weakLeads' && (category === 'strongLeads' || category === 'weakLeads')) ||
                    (leadType === 'watchlist' && (category === 'strongLeads' || category === 'weakLeads' || category === 'watchlist')) ||
                    (leadType === 'both' && (category === 'strongLeads' || category === 'weakLeads'));
                
                if (includeProject) {
                    project.category = category; // Add category to project for email display
                    qualifiedProjects.push(project);
                }
            } catch (projectError) {
                console.error('Error categorizing project:', projectError);
                // Skip this project but continue with others
            }
        }
        
        console.log(`Found ${qualifiedProjects.length} new projects matching ${leadType} criteria`);
        return qualifiedProjects;
    } catch (error) {
        console.error('Error filtering projects by lead type:', error);
        return [];
    }
}

async function waitForJobsToComplete(jobIds, maxWaitHours = 1) {
    const checkInterval = 3000; // Check every 3 seconds
    const maxWaitTime = maxWaitHours * 60 * 60 * 1000; // Max wait 1 hour
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
    const enabledCounties = await getEnabledCounties();
    const jobIds = [];
    // Use local time to match Python's datetime.now().isoformat() which uses local time
    const now = new Date();
    const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().replace('Z', '');
    const startTime = localISOTime;

    if (enabledCounties.length === 0) {
        console.log('No enabled counties found, skipping...');
        // TODO: send email to user that there are no counties enabled
        return;
    }
    
    for (const county of enabledCounties) {
        const jobId = await createScrapingJob(county.code);
        jobIds.push(jobId);
        console.log(`Created job for ${county.name} with ID: ${jobId}`);
    }
    
    console.log(`Created ${jobIds.length} jobs, waiting for completion...`);
    
    try {
        await waitForJobsToComplete(jobIds, 4); // wait up to 4 hours for all scraping jobs to complete
        console.log("All jobs complete, logging any new projects");
        
        // Get all new projects from this scraping session
        const newProjects = await getProjectScrapedAfter(startTime);
        console.log(`Found ${newProjects.length} new projects`);
        
        // Get email settings to determine what to send
        const { emails, leadType } = await getEmailSettings();
        
        if (emails && emails.trim()) {
            console.log(`Filtering projects for lead type: ${leadType}`);
            
            // Filter projects based on the configured lead type
            const qualifiedProjects = await filterProjectsByLeadType(newProjects, leadType);
            
            // Send email with summary and qualified projects
            try {
                await sendScheduledLeadsEmail(emails, newProjects.length, qualifiedProjects, leadType);
                console.log('Email notifications sent successfully');
            } catch (emailError) {
                console.error('Failed to send email notifications:', emailError);
                // Don't throw here - we still want to update lastJobRun even if email fails
            }
        } else {
            console.log('No email addresses configured, skipping email notifications');
        }
        
        // Set lastJobRun to now (ISO string)
        await updateLastJobRun(new Date().toISOString());
        
    } catch (error) {
        console.error('Error waiting for jobs to complete:', error);
        // TODO: send email to admin warning that there was an issue
        throw error;
    }
}


async function shouldRunJob() {
    const {emails, frequency, leadType, weeklyDay, monthlyDay, lastJobRun} = await getEmailSettings();
    console.log('emails', emails);
    console.log('frequency', frequency);
    console.log('leadType', leadType);
    console.log('weeklyDay', weeklyDay);
    console.log('monthlyDay', monthlyDay);
    console.log('lastJobRun', lastJobRun);
    if (!emails || !frequency || !leadType || !weeklyDay || !monthlyDay) {
        console.log('No email settings found, job not needed');
        return false;
    }

    if (!lastJobRun) {
        console.log('No lastJobRun found, running now');
        return true;
    }

    if (frequency === 'daily') {
        const lastJobRunDate = new Date(lastJobRun);
        const now = await getCurrentDate();
        
        // Check if it's the following day and after scheduled hour
        const isNextDay = now.getDate() !== lastJobRunDate.getDate() || 
                         now.getMonth() !== lastJobRunDate.getMonth() || 
                         now.getFullYear() !== lastJobRunDate.getFullYear();
        const isAfterScheduledHour = now.getHours() >= SCHEDULED_HOUR;
        
        if (isNextDay && isAfterScheduledHour) {
            return true;
        } else {
            return false;
        }
    }

    if (frequency === 'weekly') {
        const lastJobRunDate = new Date(lastJobRun);
        const now = await getCurrentDate();
        
        // Check if it's the correct day of week and after scheduled hour
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const targetDay = parseInt(weeklyDay); // Should be 0-6
        const isCorrectDay = currentDay === targetDay;
        const isAfterScheduledHour = now.getHours() >= SCHEDULED_HOUR;
        
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
        const lastJobRunDate = new Date(lastJobRun);
        const now = await getCurrentDate();
        
        // Check if it's the correct day of month and after scheduled hour
        const currentDate = now.getDate();
        const targetDate = parseInt(monthlyDay);
        const isCorrectDate = currentDate === targetDate;
        const isAfterScheduledHour = now.getHours() >= SCHEDULED_HOUR;
        
        // Check if at least a month has passed since last run
        const lastRunMonth = lastJobRunDate.getMonth();
        const lastRunYear = lastJobRunDate.getFullYear();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const hasBeenAMonth = (currentYear > lastRunYear) || 
                             (currentYear === lastRunYear && currentMonth > lastRunMonth);
        
        if (isCorrectDate && isAfterScheduledHour && hasBeenAMonth) {
            return true;
        } else {
            return false;
        }
    }
    console.log('invalid frequency', frequency);
    return false;
}

async function safeRunJob() {
    // prevent concurrent job execution to avoid complex errors and race conditions
    if (isJobRunning) {
        console.log('Job is already running, skipping...');
        return;
    }
    
    isJobRunning = true;
    console.log('Starting job...');
    
    try {
        const shouldRun = await shouldRunJob();
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (shouldRun) {
            await processAllJobs();
        }
    } catch (error) {
        console.error('Error during job execution:', error);
    } finally {
        isJobRunning = false;
        console.log('Job completed, lock released');
    }
}

async function initScheduler() {
    // run once on server start
    await safeRunJob();
    // run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        await safeRunJob();
    });
}


module.exports = {
    initScheduler
}