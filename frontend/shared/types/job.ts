export type Job = {
  id: string
  type: string
  channelName: string
  channelId: string
  status: 'running' | 'completed' | 'failed' | 'waiting' | 'queued'
  startTime: Date
  endTime?: Date
  duration?: number
  currentTask?: string
  currentStep?: string
  progressCurrent?: number
  progressTotal?: number
  videosProcessed: number
  videosFound?: number
  successCount?: number
  failureCount?: number
  errorMessage?: string
  viralVideosDetected?: number
  newVideos?: number
  updatedVideos?: number
}
