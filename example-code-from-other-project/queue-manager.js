const path = require('path');
const { spawn } = require('child_process');
const { updateScrapingJob, getNextPendingJob } = require('./database/jobs');

class QueueManager {
    constructor() {
        this.isProcessing = false;
        this.currentProcess = null;
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
            console.log(`Starting job ${job.id} for county ${job.county_id}`);
            
            // Update job status to running
            await updateScrapingJob(job.id, { 
                status: 'running',
                started_at: new Date().toISOString()
            });

            // Start the scraping process using the virtual environment
            const pythonPath = path.join(__dirname, '..', 'scraping', '.venv', 'bin', 'python');
            this.currentProcess = spawn(pythonPath, [
                path.join(__dirname, '..', 'scraping', 'dgs_scraper.py'), 
                job.county_id, 
                `--job-id=${job.id}`
            ], {
                cwd: path.join(__dirname, '..'),
                stdio: 'pipe'
            });

            // Handle process output
            this.currentProcess.stdout.on('data', (data) => {
                console.log(`Job ${job.id}: ${data.toString()}`);
            });

            this.currentProcess.stderr.on('data', (data) => {
                console.error(`Job ${job.id} error: ${data.toString()}`);
            });

            // Handle process completion
            this.currentProcess.on('exit', async (code) => {
                console.log(`Job ${job.id} exited with code ${code}`);
                
                try {
                    if (code === 0) {
                        await updateScrapingJob(job.id, { 
                            status: 'completed',
                            completed_at: new Date().toISOString()
                        });
                    } else {
                        await updateScrapingJob(job.id, { 
                            status: 'failed',
                            completed_at: new Date().toISOString(),
                            error_message: `Process exited with code ${code}`
                        });
                    }
                } catch (error) {
                    console.error(`Error updating job ${job.id}:`, error);
                }

                this.cleanup();
                
                // Process next job after a short delay
                setTimeout(() => {
                    this.processQueue();
                }, 1000);
            });

            this.currentProcess.on('error', async (error) => {
                console.error(`Job ${job.id} process error:`, error);
                
                try {
                    await updateScrapingJob(job.id, { 
                        status: 'failed',
                        completed_at: new Date().toISOString(),
                        error_message: error.message
                    });
                } catch (updateError) {
                    console.error(`Error updating job ${job.id}:`, updateError);
                }

                this.cleanup();
                
                // Process next job after a short delay
                setTimeout(() => {
                    this.processQueue();
                }, 1000);
            });

        } catch (error) {
            console.error(`Error starting job ${job.id}:`, error);
            
            try {
                await updateScrapingJob(job.id, { 
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    error_message: error.message
                });
            } catch (updateError) {
                console.error(`Error updating job ${job.id}:`, updateError);
            }

            this.cleanup();
        }
    }

    cleanup() {
        this.isProcessing = false;
        this.currentProcess = null;
        this.currentJobId = null;
    }

    stopCurrentJob() {
        if (this.currentProcess && this.currentProcess.exitCode === null) {
            this.currentProcess.kill('SIGTERM');
            return true;
        }
        return false;
    }

    getCurrentJobId() {
        return this.currentJobId;
    }

    isCurrentlyProcessing() {
        return this.isProcessing;
    }
}

module.exports = QueueManager; 