"use client"

import React from 'react'
import { Clock } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContentCard } from './ContentCard'
import { PlatformContent, PlatformChannel, AnalyticsCriteria } from '@/types/platform'
import { formatDate, getThumbnailUrl, getContentUrl, getEngagementMetrics, formatNumber, getContentDuration } from '@/lib/platform-utils'
import * as Icons from 'lucide-react'

interface AnalyticsTabsProps {
  channel: PlatformChannel
  topContent: {
    views: PlatformContent[]
    likes: PlatformContent[]
    comments: PlatformContent[]
  }
  viralContent: PlatformContent[]
  recentContent: PlatformContent[]
  criteria: AnalyticsCriteria
  timeRanges: Array<{ label: string, value: string, days: number }>
}

export function AnalyticsTabs({ 
  channel, 
  topContent, 
  viralContent, 
  recentContent, 
  criteria, 
  timeRanges 
}: AnalyticsTabsProps) {
  const currentTimeRange = timeRanges.find(r => r.value === criteria.timeRange)?.label || 'All time'
  const contentType = channel.platform === 'youtube' ? 'Videos' : 'Posts'
  const viralType = channel.platform === 'youtube' ? 'Videos' : 'Posts'
  
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <div className="flex items-center justify-between">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="viral">Viral {viralType}</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
        </TabsList>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Time Range: {currentTimeRange}</span>
          <span className="text-xs">(set in global criteria)</span>
        </div>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing {contentType}</CardTitle>
            <CardDescription>
              {contentType} with highest engagement scores from the selected time period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topContent.views.map((content, index) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  index={index}
                  channel={channel}
                  viralMultiplier={criteria.viralMultiplier}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="viral" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Viral {viralType}</CardTitle>
            <CardDescription>
              {viralType} with {criteria.viralMultiplier}x+ more {channel.platform === 'youtube' ? 'views than subscriber' : 'likes than follower'} count from the selected time period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {viralContent.map((content, index) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  index={index}
                  channel={channel}
                  viralMultiplier={criteria.viralMultiplier}
                  showViral={true}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="recent" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent {contentType} ({currentTimeRange})</CardTitle>
            <CardDescription>
              All {contentType.toLowerCase()} from the selected time period, ordered by engagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{channel.platform === 'youtube' ? 'Video' : 'Post'}</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>{channel.platform === 'youtube' ? 'Views' : 'Likes'}</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead>{channel.platform === 'youtube' ? 'Likes' : 'Engagement'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentContent.map((content) => {
                  const metrics = getEngagementMetrics(content)
                  const thumbnailUrl = getThumbnailUrl(content)
                  const contentUrl = getContentUrl(content)
                  const duration = getContentDuration(content)
                  
                  return (
                    <TableRow key={content.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <a href={contentUrl} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={thumbnailUrl || "/placeholder.svg"}
                              alt={content.title}
                              className="w-16 h-9 object-cover rounded"
                            />
                          </a>
                          <div>
                            <p className="font-medium line-clamp-2 max-w-xs">
                              <a href={contentUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {content.title}
                              </a>
                            </p>
                            {duration && (
                              <p className="text-sm text-muted-foreground">{duration}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(content.publishedAt)}</TableCell>
                      <TableCell>{formatNumber(metrics.primary.value)}</TableCell>
                      <TableCell>{formatNumber(metrics.secondary.value)}</TableCell>
                      <TableCell>{formatNumber(metrics.tertiary.value)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
