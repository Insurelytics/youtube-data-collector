"use client"

import React from 'react'
import Link from "next/link"
import { RefreshCcw, Trash2, ExternalLink } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PlatformChannel } from '@/types/platform'
import { formatNumber, getChannelMetrics, getPlatformColor } from '@/lib/platform-utils'
import * as Icons from 'lucide-react'

interface PlatformChannelCardProps {
  channel: PlatformChannel
  onRemove: (id: string) => void
  onResync: (handle: string) => void
  loading?: boolean
}

export function PlatformChannelCard({ 
  channel, 
  onRemove, 
  onResync, 
  loading = false 
}: PlatformChannelCardProps) {
  const metrics = getChannelMetrics(channel)
  
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={channel.thumbnailUrl || "/placeholder.svg"} alt={channel.title} />
              <AvatarFallback>{channel.title.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{channel.title}</CardTitle>
                <div className={`w-2 h-2 rounded-full bg-${getPlatformColor(channel.platform)}-500`} />
              </div>
              <CardDescription>{channel.handle}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Re-Sync"
              onClick={() => channel.handle && onResync(channel.handle)}
              disabled={loading}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(channel.id)}
              disabled={loading}
              className="text-destructive hover:text-destructive"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            {React.createElement((Icons as any)[metrics.primary.icon], { className: "h-4 w-4 text-muted-foreground" })}
            <span>{formatNumber(metrics.primary.value)} {metrics.primary.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {React.createElement((Icons as any)[metrics.tertiary.icon], { className: "h-4 w-4 text-muted-foreground" })}
            <span>{formatNumber(metrics.tertiary.value)} {metrics.tertiary.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {React.createElement((Icons as any)[metrics.secondary.icon], { className: "h-4 w-4 text-muted-foreground" })}
            <span>{formatNumber(metrics.secondary.value)} {metrics.secondary.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {React.createElement((Icons as any)[metrics.viral.icon], { className: `h-4 w-4 text-${getPlatformColor(channel.platform)}-500` })}
            <span>{formatNumber(metrics.viral.value)} {metrics.viral.label}</span>
          </div>
        </div>
        <div className="flex justify-center">
          <Badge variant="secondary" className="text-xs">
            {channel.platform === 'youtube' 
              ? `${formatNumber((channel as any).avgViews || 0)} avg views`
              : `${formatNumber((channel as any).avgLikes || 0)} avg likes`
            }
          </Badge>
        </div>
        <Link href={`/dashboard/${channel.platform}/${channel.id}`}>
          <Button className="w-full">
            View Dashboard
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
