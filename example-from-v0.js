"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Play, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock data for jobs
const initialRunningJobs = [
  {
    id: "job-1",
    type: "Channel Scrape",
    channelName: "TechReview Pro",
    channelId: "1",
    status: "running",
    startTime: new Date(Date.now() - 45000), // Started 45 seconds ago
    currentTask: "Fetching video metadata",
    videosProcessed: 23,
  },
  {
    id: "job-2",
    type: "Channel Scrape",
    channelName: "Gaming Central",
    channelId: "2",
    status: "running",
    startTime: new Date(Date.now() - 120000), // Started 2 minutes ago
    currentTask: "Analyzing engagement metrics",
    videosProcessed: 67,
  },
]

const completedJobs = [
  {
    id: "job-3",
    type: "Channel Scrape",
    channelName: "Cooking Masters",
    channelId: "3",
    status: "completed",
    startTime: new Date(Date.now() - 600000), // Started 10 minutes ago
    endTime: new Date(Date.now() - 300000), // Ended 5 minutes ago
    duration: 300000, // 5 minutes
    videosFound: 45,
    videosProcessed: 45,
    successCount: 43,
    failureCount: 2,
    viralVideosDetected: 1,
    newVideos: 3,
    updatedVideos: 42,
  },
  {
    id: "job-4",
    type: "Channel Scrape",
    channelName: "TechReview Pro",
    channelId: "1",
    status: "completed",
    startTime: new Date(Date.now() - 3600000), // Started 1 hour ago
    endTime: new Date(Date.now() - 3300000), // Ended 55 minutes ago
    duration: 300000, // 5 minutes
    videosFound: 89,
    videosProcessed: 89,
    successCount: 87,
    failureCount: 2,
    viralVideosDetected: 2,
    newVideos: 5,
    updatedVideos: 84,
  },
  {
    id: "job-5",
    type: "Channel Scrape",
    channelName: "Gaming Central",
    channelId: "2",
    status: "failed",
    startTime: new Date(Date.now() - 7200000), // Started 2 hours ago
    endTime: new Date(Date.now() - 7080000), // Ended 1h58m ago
    duration: 120000, // 2 minutes
    videosFound: 0,
    videosProcessed: 0,
    successCount: 0,
    failureCount: 1,
    errorMessage: "API rate limit exceeded",
    viralVideosDetected: 0,
    newVideos: 0,
    updatedVideos: 0,
  },
]

export default function JobsPage() {
  const [runningJobs, setRunningJobs] = useState(initialRunningJobs)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second for elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const getElapsedTime = (startTime: Date) => {
    return currentTime.getTime() - startTime.getTime()
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Channels
            </Button>
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <Play className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Jobs</h1>
          </div>
          <p className="text-muted-foreground">Monitor running and completed scraping jobs</p>
        </div>

        <Tabs defaultValue="running" className="space-y-6">
          <TabsList>
            <TabsTrigger value="running" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Running ({runningJobs.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              History ({completedJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="running" className="space-y-4">
            {runningJobs.length > 0 ? (
              <div className="space-y-4">
                {runningJobs.map((job) => (
                  <Card key={job.id}>
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Elapsed Time</p>
                          <p className="text-lg font-semibold">{formatDuration(getElapsedTime(job.startTime))}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Videos Processed</p>
                          <p className="text-lg font-semibold">{job.videosProcessed}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Current Task</p>
                          <p className="text-sm">{job.currentTask}</p>
                        </div>
                      </div>
                      <div className="mt-4 text-xs text-muted-foreground">
                        Started at {formatDateTime(job.startTime)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Play className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No running jobs</h3>
                  <p className="text-muted-foreground text-center">All scraping jobs are currently idle</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job History</CardTitle>
                <CardDescription>Recent completed and failed scraping jobs</CardDescription>
              </CardHeader>
              <CardContent>
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
                    {completedJobs.map((job) => (
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
                        <TableCell>{formatDuration(job.duration)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{job.videosFound} found</p>
                            <p className="text-muted-foreground">
                              {job.newVideos} new, {job.updatedVideos} updated
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.videosProcessed > 0 ? (
                            <div className="text-sm">
                              <p>{Math.round((job.successCount / job.videosProcessed) * 100)}%</p>
                              <p className="text-muted-foreground">
                                {job.successCount}/{job.videosProcessed}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.viralVideosDetected > 0 ? (
                            <Badge variant="destructive" className="bg-orange-500">
                              {job.viralVideosDetected} viral
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(job.endTime!)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
