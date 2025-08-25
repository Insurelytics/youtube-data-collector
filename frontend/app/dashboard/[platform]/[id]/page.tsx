"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { PlatformChannelHeader } from "@/components/dashboard/PlatformChannelHeader"
import { AnalyticsTabs } from "@/components/dashboard/AnalyticsTabs"
import { PlatformChannel, PlatformContent, AnalyticsCriteria, Platform } from '@/types/platform'

// Time range options with their corresponding days
const TIME_RANGES = [
  { label: "7 days", value: "7", days: 7 },
  { label: "30 days", value: "30", days: 30 },
  { label: "90 days", value: "90", days: 90 },
  { label: "6 months", value: "180", days: 180 },
  { label: "1 year", value: "365", days: 365 },
  { label: "All time", value: "36500", days: 36500 }
]

function getGlobalCriteria(): AnalyticsCriteria {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('platform-global-criteria')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {}
    }
  }
  return {
    viralMultiplier: 5,
    commentWeight: 500,
    likeWeight: 150,
    timeRange: '90'
  }
}

export default function PlatformChannelDashboard() {
  const params = useParams<{ platform: string, id: string }>()
  const platform = params?.platform as Platform
  const id = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<PlatformChannel | null>(null)
  const [topContent, setTopContent] = useState<{views: PlatformContent[]; likes: PlatformContent[]; comments: PlatformContent[]}>({
    views: [],
    likes: [],
    comments: []
  })
  const [viralContent, setViralContent] = useState<PlatformContent[]>([])
  const [recentContent, setRecentContent] = useState<PlatformContent[]>([])
  const [criteria, setCriteria] = useState(getGlobalCriteria())

  // Update criteria when global criteria changes or on focus
  useEffect(() => {
    const handleStorageChange = () => {
      setCriteria(getGlobalCriteria())
    }
    const handleFocus = () => {
      setCriteria(getGlobalCriteria())
    }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleFocus)
    setCriteria(getGlobalCriteria())
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    
    ;(async () => {
      try {
        const params = new URLSearchParams({
          days: criteria.timeRange,
          viralMultiplier: criteria.viralMultiplier.toString(),
          likeWeight: criteria.likeWeight.toString(),
          commentWeight: criteria.commentWeight.toString()
        })
        
        const res = await fetch(`/api/channels/${platform}/${id}/dashboard?${params.toString()}`)
        const data = await res.json()
        
        if (!res.ok) throw new Error(data?.error || 'failed')
        if (!mounted) return
        
        setChannel(data.channel)
        setTopContent(data.top || { views: [], likes: [], comments: [] })
        setViralContent(data.special || [])
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    ;(async () => {
      const params = new URLSearchParams({
        platform,
        channelId: id,
        days: criteria.timeRange,
        likeWeight: criteria.likeWeight.toString(),
        commentWeight: criteria.commentWeight.toString()
      })
      
      const res = await fetch(`/api/content/engagement?${params.toString()}`)
      const d = await res.json()
      setRecentContent(Array.isArray(d?.rows) ? d.rows : [])
    })()

    return () => { mounted = false }
  }, [platform, id, criteria])

  if (loading) return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">Loading…</div>
    </div>
  )

  if (!channel) return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">Channel not found</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <PlatformChannelHeader channel={channel} backHref="/" />
        <AnalyticsTabs 
          channel={channel}
          topContent={topContent}
          viralContent={viralContent}
          recentContent={recentContent}
          criteria={criteria}
          timeRanges={TIME_RANGES}
        />
      </div>
    </div>
  )
}
