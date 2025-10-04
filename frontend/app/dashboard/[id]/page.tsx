"use client"

import React, { useEffect, useState } from "react"
import { ArrowLeft, Users, Eye, Calendar, Play, Clock } from 'lucide-react'
import Link from "next/link"
import { useParams } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { VideoCard } from "@/components/VideoCard"
import { formatNumber, formatDate, getPostUrl } from "@/lib/video-utils"

// Time range options with their corresponding days
const TIME_RANGES = [
  { label: "7 days", value: "7", days: 7 },
  { label: "30 days", value: "30", days: 30 },
  { label: "90 days", value: "90", days: 90 },
  { label: "6 months", value: "180", days: 180 },
  { label: "1 year", value: "365", days: 365 },
  { label: "All time", value: "36500", days: 36500 }
]

function getGlobalCriteria() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('youtube-global-criteria')
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
    timeRange: '90',
    viralMethod: 'subscribers'
  }
}

export default function ChannelDashboard() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<any | null>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [top, setTop] = useState<{views:any[];likes:any[];comments:any[]}>({views:[],likes:[],comments:[]})
  const [special, setSpecial] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [criteria, setCriteria] = useState(getGlobalCriteria())
  const { toast } = useToast()
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null)
  const [showAddChannelDialog, setShowAddChannelDialog] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<any | null>(null)
  const [addedVideos, setAddedVideos] = useState<Set<string>>(new Set());
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);


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
    // Also check on mount in case criteria changed while on another page
    setCriteria(getGlobalCriteria())
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const isViralVideo = (video: any) => {
    if (!channel) return false
    const base = criteria.viralMethod === 'avgViews' ? Number(channel.avgViews) : Number(channel.subscriberCount)
    const viewCount = Number(video.viewCount || 0)
    return base > 0 && viewCount >= base * criteria.viralMultiplier
  }

  async function addToSheet(video: any) {
    if (!channel) return
    setAddingVideoId(video.id)
    try {
      const videoLink = getPostUrl(video)
      const res = await fetch('/api/drive/add-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channel.id,
          videoLink,
          viewCount: video.viewCount || 0
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const errorMsg = err?.error || 'Failed to add to sheet'
        
        // Check if channel needs to be added first
        if (errorMsg.includes('Channel not found in spreadsheet')) {
          setPendingVideo(video)
          setShowAddChannelDialog(true)
          return
        }
        
        throw new Error(errorMsg)
      }
      const data = await res.json()
      if (data.added || data.updated || data.viewsUpdated || data.message) {
        setAddedVideos(prev => new Set([...prev, video.id]));
        if (data.spreadsheetUrl) {
          setSheetUrl(data.spreadsheetUrl);
        }
      }
      toast({
        title: data?.updated || data?.viewsUpdated ? "Video updated in 10X10" : (data?.added ? "Video added to 10X10" : "Video already in 10X10"),
        description: data?.sheetTitle ? `Target: ${data.sheetTitle}` : (data?.message || undefined)
      })
    } catch (e: any) {
      toast({
        title: "Failed to add video",
        description: e?.message || "An unexpected error occurred.",
        variant: "destructive"
      })
    } finally {
      setAddingVideoId(null)
    }
  }

  async function addChannelThenReel() {
    if (!channel || !pendingVideo) return
    setShowAddChannelDialog(false)
    setAddingVideoId(pendingVideo.id)
    
    try {
      // First add the channel
      const channelRes = await fetch('/api/drive/add-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channel.id })
      })
      
      if (!channelRes.ok) {
        const err = await channelRes.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to add channel')
      }
      
      toast({
        title: "Channel added to 10X10",
        description: `${channel.title} has been added to the spreadsheet`
      })
      
      // Then add the reel
      const videoLink = getPostUrl(pendingVideo)
      const reelRes = await fetch('/api/drive/add-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channel.id,
          videoLink,
          viewCount: pendingVideo.viewCount || 0
        })
      })
      
      if (!reelRes.ok) {
        const err = await reelRes.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to add reel')
      }
      
      const data = await reelRes.json()
      if (data.added || data.updated || data.viewsUpdated || data.message) {
        setAddedVideos(prev => new Set([...prev, pendingVideo.id]));
        if (data.spreadsheetUrl) {
          setSheetUrl(data.spreadsheetUrl);
        }
      }
      toast({
        title: data?.updated || data?.viewsUpdated ? "Video updated in 10X10" : (data?.added ? "Video added to 10X10" : "Video already in 10X10"),
        description: data?.sheetTitle ? `Target: ${data.sheetTitle}` : (data?.message || undefined)
      })
    } catch (e: any) {
      toast({
        title: "Failed to add video",
        description: e?.message || "An unexpected error occurred.",
        variant: "destructive"
      })
    } finally {
      setAddingVideoId(null)
      setPendingVideo(null)
    }
  }

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
        const res = await fetch(`/api/channels/${id}/dashboard?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'failed')
        if (!mounted) return
        setChannel(data.channel)
        setTrends(data.trends || [])
        setTop(data.top || {views:[],likes:[],comments:[]})
        setSpecial(data.special || [])
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    ;(async () => {
      const params = new URLSearchParams({
        channelId: id,
        days: criteria.timeRange,
        likeWeight: criteria.likeWeight.toString(),
        commentWeight: criteria.commentWeight.toString()
      })
      const res = await fetch(`/api/videos/engagement?${params.toString()}`)
      const d = await res.json()
      setRecent(Array.isArray(d?.rows) ? d.rows : [])
    })()

    return () => { mounted = false }
  }, [id, criteria])

  if (loading) return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background"><div className="container mx-auto p-6">Loading…</div></div>
    </ProtectedRoute>
  )

  if (!channel) return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background"><div className="container mx-auto p-6">Channel not found</div></div>
    </ProtectedRoute>
  )

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Channels
            </Button>
          </Link>
          
          <Card>
            <CardContent className="pt-6">
              {channel.initial_scrape_running && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span className="font-medium">Initial scrape running...</span>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    This may take up to 15 minutes. Videos will appear as they are processed.
                  </p>
                </div>
              )}
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={channel.thumbnailUrl || "/placeholder.svg"} alt={channel.title} />
                  <AvatarFallback className="text-2xl">{channel.title.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">
                    {channel.title}
                    {channel.verified && (
                      <Badge variant="secondary" className="ml-2">
                        ✓ Verified
                      </Badge>
                    )}
                  </h1>
                  <p className="text-muted-foreground mb-2">{channel.handle}</p>
                  {channel.biography && (
                    <p className="text-sm text-muted-foreground mb-4">{channel.biography}</p>
                  )}
                  {channel.businessCategoryName && (
                    <p className="text-xs text-muted-foreground mb-4">{channel.businessCategoryName}</p>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{formatNumber(channel.subscriberCount || 0)}</span>
                      <span className="text-sm text-muted-foreground">
                        {channel.platform === 'instagram' ? 'followers' : 'subscribers'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{formatNumber(channel.videoCount || channel.postsCount || 0)}</span>
                      <span className="text-sm text-muted-foreground">
                        {channel.platform === 'instagram' ? 'posts' : 'videos'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{formatNumber(channel.totalViews || 0)}</span>
                      <span className="text-sm text-muted-foreground">total views</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Last sync: {channel.lastSyncedAt ? formatDate(channel.lastSyncedAt) : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="viral">Viral Videos</TabsTrigger>
              <TabsTrigger value="recent">All Videos</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Time Range: {TIME_RANGES.find(r => r.value === criteria.timeRange)?.label || 'All time'}</span>
              <span className="text-xs">(set in global criteria)</span>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Top Performing Videos */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Videos</CardTitle>
                <CardDescription>Videos with highest engagement scores from the selected time period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {top.views.map((video, index) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      variant="large"
                      rank={index + 1}
                      isAdded={addedVideos.has(video.id)}
                      isLoading={addingVideoId === video.id}
                      onAdd={() => addToSheet(video)}
                      sheetUrl={sheetUrl}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="viral" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Viral Videos</CardTitle>
                <CardDescription>Videos with {criteria.viralMultiplier}x+ more views than {criteria.viralMethod === 'avgViews' ? 'average views' : 'subscriber count'} from the selected time period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {special.map((video, index) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      variant="large"
                      isViral={true}
                      isAdded={addedVideos.has(video.id)}
                      isLoading={addingVideoId === video.id}
                      onAdd={() => addToSheet(video)}
                      sheetUrl={sheetUrl}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Videos ({TIME_RANGES.find(r => r.value === criteria.timeRange)?.label || 'All time'})</CardTitle>
                <CardDescription>All videos from the selected time period, ordered by engagement</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Video</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Likes</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        variant="table-row"
                        isAdded={addedVideos.has(video.id)}
                        isLoading={addingVideoId === video.id}
                        onAdd={() => addToSheet(video)}
                        sheetUrl={sheetUrl}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showAddChannelDialog} onOpenChange={setShowAddChannelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Channel to 10X10?</AlertDialogTitle>
            <AlertDialogDescription>
              {channel?.title} isn't in your 10X10 spreadsheet yet. Would you like to add it first and then add this video?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingVideo(null); setAddingVideoId(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={addChannelThenReel}>Add Channel and Video</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </ProtectedRoute>
  )
}
