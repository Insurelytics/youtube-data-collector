"use client"

import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Job } from "@/shared/types/job"
import { formatDuration, formatDateTime } from "@/shared/utils/jobUtils"

interface JobHistoryTableProps {
  jobs: Job[]
}

export function JobHistoryTable({ jobs }: JobHistoryTableProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
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
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Videos</TableHead>
          <TableHead>Success Rate</TableHead>
          <TableHead>Viral Found</TableHead>
          <TableHead>Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell>
              <div>
                <p className="font-medium">{job.channelName}</p>
                <p className="text-sm text-muted-foreground">{job.type}</p>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getStatusIcon(job.status)}
                {getStatusBadge(job.status)}
              </div>
              {job.status === "failed" && job.errorMessage && (
                <p className="text-xs text-red-500 mt-1">{job.errorMessage}</p>
              )}
            </TableCell>
            <TableCell>{job.duration ? formatDuration(job.duration) : "N/A"}</TableCell>
            <TableCell>
              <div className="text-sm">
                <p>{job.videosFound || 0} found</p>
                <p className="text-muted-foreground">
                  {job.newVideos || 0} new, {job.updatedVideos || 0} updated
                </p>
              </div>
            </TableCell>
            <TableCell>
              {job.videosProcessed && job.videosProcessed > 0 ? (
                <div className="text-sm">
                  <p>{Math.round(((job.successCount || 0) / job.videosProcessed) * 100)}%</p>
                  <p className="text-muted-foreground">
                    {job.successCount || 0}/{job.videosProcessed}
                  </p>
                </div>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </TableCell>
            <TableCell>
              {(job.viralVideosDetected || 0) > 0 ? (
                <Badge variant="destructive" className="bg-orange-500">
                  {job.viralVideosDetected} viral
                </Badge>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {job.endTime ? formatDateTime(job.endTime) : "N/A"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
