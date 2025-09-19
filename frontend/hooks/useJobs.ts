"use client"

import { useState, useEffect } from 'react'

export interface BackendJob {
  id: number
  handle: string
  platform: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: string
  started_at?: string
  completed_at?: string
  error_message?: string
  since_days?: number
  is_initial_scrape?: number
  channel_id?: string
  channel_title?: string
  videos_found?: number
  videos_processed?: number
  new_videos?: number
  updated_videos?: number
  current_step?: string
  progress_current?: number
  progress_total?: number
}

export interface JobsResponse {
  total: number
  jobs: BackendJob[]
}

export interface QueueStatus {
  isProcessing: boolean
  currentJobId: number | null
}

// Convert backend job to frontend Job type
export function transformBackendJob(backendJob: BackendJob) {
  const startTime = new Date(backendJob.created_at)
  const endTime = backendJob.completed_at ? new Date(backendJob.completed_at) : undefined
  const duration = endTime ? endTime.getTime() - startTime.getTime() : undefined

  // Determine if this is an initial scrape using explicit flag from backend when available
  const isInitialScrape = typeof backendJob.is_initial_scrape === 'number'
    ? backendJob.is_initial_scrape === 1
    : (!backendJob.since_days || backendJob.since_days >= 36500);
  const platformName = backendJob.platform === 'youtube' ? 'YouTube' : 'Instagram';
  const jobType = isInitialScrape ? `${platformName} Initial Scrape` : `${platformName} Sync`;

  return {
    id: backendJob.id.toString(),
    type: jobType,
    channelName: backendJob.channel_title || backendJob.handle,
    channelId: backendJob.channel_id || backendJob.handle,
    status: backendJob.status === 'pending' ? 'queued' as const : backendJob.status,
    startTime,
    endTime,
    duration,
    currentStep: backendJob.current_step,
    progressCurrent: backendJob.progress_current,
    progressTotal: backendJob.progress_total,
    videosProcessed: backendJob.videos_processed || 0,
    videosFound: backendJob.videos_found || 0,
    successCount: backendJob.videos_processed || 0, // Assume all processed are successful for now
    failureCount: 0, // We don't track individual failures yet
    errorMessage: backendJob.error_message,
    viralVideosDetected: 0, // We don't track viral videos in sync jobs yet
    newVideos: backendJob.new_videos || 0,
    updatedVideos: backendJob.updated_videos || 0,
  }
}

export function useJobs(refreshInterval = 5000) {
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ isProcessing: false, currentJobId: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs?limit=100')
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.status}`)
      }
      const data: JobsResponse = await response.json()
      setJobs(data.jobs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
      console.error('Error fetching jobs:', err)
    }
  }

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/queue/status')
      if (!response.ok) {
        throw new Error(`Failed to fetch queue status: ${response.status}`)
      }
      const data: QueueStatus = await response.json()
      setQueueStatus(data)
    } catch (err) {
      console.error('Error fetching queue status:', err)
    }
  }

  const fetchData = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true)
    }
    await Promise.all([fetchJobs(), fetchQueueStatus()])
    if (isInitialLoad) {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(true) // Initial load
    
    const interval = setInterval(() => fetchData(false), refreshInterval) // Subsequent updates
    return () => clearInterval(interval)
  }, [refreshInterval])

  // Separate jobs by status
  const runningJobs = jobs.filter(job => job.status === 'running' || job.status === 'pending')
  const completedJobs = jobs.filter(job => job.status === 'completed' || job.status === 'failed')

  return {
    jobs,
    runningJobs: runningJobs.map(transformBackendJob),
    completedJobs: completedJobs.map(transformBackendJob),
    queueStatus,
    loading,
    error,
    refetch: () => fetchData(false), // Don't show loading on manual refresh
  }
}

export function useJobStatus(jobId: string | number) {
  const [job, setJob] = useState<BackendJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/jobs/${jobId}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch job: ${response.status}`)
        }
        const data: BackendJob = await response.json()
        setJob(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch job')
        console.error('Error fetching job:', err)
      } finally {
        setLoading(false)
      }
    }

    if (jobId) {
      fetchJob()
    }
  }, [jobId])

  return {
    job: job ? transformBackendJob(job) : null,
    loading,
    error,
  }
}
