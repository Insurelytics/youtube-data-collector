"use client"

import { ArrowLeft, Calendar } from 'lucide-react'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PlatformChannel } from '@/types/platform'
import { formatNumber, formatDate, getChannelMetrics, getPlatformColor } from '@/lib/platform-utils'
import * as Icons from 'lucide-react'

interface PlatformChannelHeaderProps {
  channel: PlatformChannel
  backHref?: string
}

export function PlatformChannelHeader({ channel, backHref = "/" }: PlatformChannelHeaderProps) {
  const metrics = getChannelMetrics(channel)
  
  return (
    <div className="mb-6">
      <Link href={backHref}>
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Channels
        </Button>
      </Link>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={channel.thumbnailUrl || "/placeholder.svg"} alt={channel.title} />
              <AvatarFallback className="text-2xl">{channel.title.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{channel.title}</h1>
                <div className={`w-3 h-3 rounded-full bg-${getPlatformColor(channel.platform)}-500`} />
              </div>
              <p className="text-muted-foreground mb-4">{channel.handle}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {React.createElement((Icons as any)[metrics.primary.icon], { className: "h-4 w-4 text-muted-foreground" })}
                  <span className="font-semibold">{formatNumber(metrics.primary.value)}</span>
                  <span className="text-sm text-muted-foreground">{metrics.primary.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {React.createElement((Icons as any)[metrics.secondary.icon], { className: "h-4 w-4 text-muted-foreground" })}
                  <span className="font-semibold">{formatNumber(metrics.secondary.value)}</span>
                  <span className="text-sm text-muted-foreground">{metrics.secondary.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {React.createElement((Icons as any)[metrics.tertiary.icon], { className: "h-4 w-4 text-muted-foreground" })}
                  <span className="font-semibold">{formatNumber(metrics.tertiary.value)}</span>
                  <span className="text-sm text-muted-foreground">{metrics.tertiary.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Last sync: {channel.lastSyncedAt ? formatDate(channel.lastSyncedAt) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Fix for React.createElement usage - need to import React
import React from 'react'
