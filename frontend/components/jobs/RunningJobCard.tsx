"use client"

import { RefreshCw, CheckCircle, XCircle, Clock, Pause } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Job } from "@/shared/types/job"
import { formatDuration, formatDateTime, getElapsedTime } from "@/shared/utils/jobUtils"

interface RunningJobCardProps {
  job: Job
  currentTime: Date
}

export function RunningJobCard({ job, currentTime }: RunningJobCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "queued":
        return <Pause className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <Badge variant="default" className="bg-blue-500">
            Running
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            Completed
          </Badge>
        )
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "queued":
        return (
          <Badge variant="default" className="bg-orange-500">
            Queued
          </Badge>
        )
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(job.status)}
            <div>
              <CardTitle className="text-lg">{job.channelName}</CardTitle>
              <CardDescription>{job.type}</CardDescription>
            </div>
          </div>
          {getStatusBadge(job.status)}
        </div>
      </CardHeader>
      <CardContent>
        {/* Current Step and Progress */}
        {job.status === 'running' && job.currentStep && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Current Step</p>
              {job.progressCurrent && job.progressTotal && (
                <p className="text-sm text-muted-foreground">
                  {job.progressCurrent}/{job.progressTotal}
                </p>
              )}
            </div>
            <p className="text-base font-semibold mb-3">{job.currentStep}</p>
            {job.progressCurrent && job.progressTotal && (
              <Progress 
                value={(job.progressCurrent / job.progressTotal) * 100} 
                className="h-2"
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Elapsed Time</p>
            <p className="text-lg font-semibold">{formatDuration(getElapsedTime(job.startTime, currentTime))}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Videos Processed</p>
            <p className="text-lg font-semibold">{job.videosProcessed}</p>
          </div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Started at {formatDateTime(job.startTime)}
        </div>
      </CardContent>
    </Card>
  )
}
