"use client"

import React from 'react'
import { Badge } from "@/components/ui/badge"
import { PlatformContent, PlatformChannel } from '@/types/platform'
import { formatNumber, formatDate, getThumbnailUrl, getEngagementMetrics, getContentUrl, getContentDuration, isViralContent } from '@/lib/platform-utils'
import * as Icons from 'lucide-react'

interface ContentCardProps {
  content: PlatformContent
  index?: number
  channel?: PlatformChannel
  viralMultiplier?: number
  showViral?: boolean
  className?: string
}

export function ContentCard({ 
  content, 
  index, 
  channel, 
  viralMultiplier = 5, 
  showViral = false,
  className = ""
}: ContentCardProps) {
  const metrics = getEngagementMetrics(content)
  const thumbnailUrl = getThumbnailUrl(content)
  const contentUrl = getContentUrl(content)
  const duration = getContentDuration(content)
  const isViral = channel && isViralContent(content, channel, viralMultiplier)
  
  const cardClass = showViral && isViral 
    ? "flex items-center gap-4 p-4 border rounded-lg bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20" 
    : "flex items-center gap-4 p-4 border rounded-lg"

  return (
    <div className={`${cardClass} ${className}`}>
      {typeof index === 'number' && (
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
          showViral && isViral 
            ? "bg-orange-500 text-white" 
            : "bg-primary text-primary-foreground"
        }`}>
          {showViral && isViral ? '🔥' : index + 1}
        </div>
      )}
      
      <a href={contentUrl} target="_blank" rel="noopener noreferrer">
        <img 
          src={thumbnailUrl || "/placeholder.svg"}
          alt={content.title}
          className="w-24 h-14 object-cover rounded"
        />
      </a>
      
      <div className="flex-1">
        <h3 className="font-semibold line-clamp-2">
          <a href={contentUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {content.title}
          </a>
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatDate(content.publishedAt)}</span>
          {duration && <span>• {duration}</span>}
        </div>
        {showViral && isViral && (
          <Badge variant="destructive" className="mt-1">
            {viralMultiplier}x+ viral multiplier
          </Badge>
        )}
      </div>
      
      <div className="text-right space-y-1">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            {React.createElement((Icons as any)[metrics.primary.icon], { className: "h-3 w-3" })}
            {formatNumber(metrics.primary.value)}
          </div>
          <div className="flex items-center gap-1">
            {React.createElement((Icons as any)[metrics.secondary.icon], { className: "h-3 w-3" })}
            {formatNumber(metrics.secondary.value)}
          </div>
          <div className="flex items-center gap-1">
            {React.createElement((Icons as any)[metrics.tertiary.icon], { className: "h-3 w-3" })}
            {formatNumber(metrics.tertiary.value)}
          </div>
        </div>
      </div>
    </div>
  )
}
