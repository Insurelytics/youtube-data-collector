"use client"

import { useState, useEffect } from "react"
import { Play, RefreshCw, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Job } from "@/shared/types/job"
import { initialRunningJobs, completedJobs } from "@/shared/data/mockJobs"
import { RunningJobCard } from "./RunningJobCard"
import { JobHistoryTable } from "./JobHistoryTable"

export function JobsMonitor() {
  const [runningJobs, setRunningJobs] = useState<Job[]>(initialRunningJobs)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Filter jobs for running tab (includes both running and queued)
  const runningAndQueuedJobs = runningJobs.filter(job => job.status === 'running' || job.status === 'queued')
  const actuallyRunningJobs = runningJobs.filter(job => job.status === 'running')

  // Update current time every second for elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Jobs Overview
          </CardTitle>
          <CardDescription>Monitor running and completed scraping jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{actuallyRunningJobs.length}</div>
              <div className="text-sm text-blue-700">Running Jobs</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{completedJobs.filter(j => j.status === 'completed').length}</div>
              <div className="text-sm text-green-700">Completed Jobs</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{completedJobs.filter(j => j.status === 'failed').length}</div>
              <div className="text-sm text-red-700">Failed Jobs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="running" className="space-y-6">
        <TabsList>
          <TabsTrigger value="running" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Running ({runningAndQueuedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            History ({completedJobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="running" className="space-y-4">
          {runningAndQueuedJobs.length > 0 ? (
            <div className="space-y-4">
              {runningAndQueuedJobs.map((job) => (
                <RunningJobCard key={job.id} job={job} currentTime={currentTime} />
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
              <JobHistoryTable jobs={completedJobs} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
