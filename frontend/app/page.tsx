"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, TrendingUp, Users, Eye, MessageCircle, Heart, ExternalLink, RefreshCcw, Settings, Flame, Clock, Camera, Play } from 'lucide-react'
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlatformChannelCard } from "@/components/dashboard/PlatformChannelCard"
import { Platform, PlatformChannel, AnalyticsCriteria, PLATFORM_CONFIGS } from '@/types/platform'
import { getPlatformFromUrl, extractHandle } from '@/lib/platform-utils'

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toFixed(0).toString()
}

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

export default function HomePage() {
  const [channels, setChannels] = useState<PlatformChannel[]>([])
  const [newChannelUrl, setNewChannelUrl] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('youtube')
  const [loading, setLoading] = useState(false)
  const [criteria, setCriteria] = useState(getGlobalCriteria())

  async function loadChannels() {
    const params = new URLSearchParams({
      viralMultiplier: criteria.viralMultiplier.toString(),
      days: criteria.timeRange
    })
    
    // Load all platform channels
    const allChannels: PlatformChannel[] = []
    
    // Load YouTube channels
    try {
      const res = await fetch(`/api/channels/youtube?${params.toString()}`)
      const data = await res.json()
      const rows = Array.isArray(data?.rows) ? data.rows : []
      const active = rows.filter((r: any) => r.isActive)
      const youtubeChannels: PlatformChannel[] = active.map((r: any) => ({
        platform: 'youtube' as const,
        id: r.id,
        title: r.title,
        handle: r.handle || "",
        subscriberCount: Number(r.subscriberCount || 0),
        thumbnailUrl: r.thumbnailUrl || "/placeholder.svg",
        videoCount: Number(r.videoCount || 0),
        totalViews: Number(r.totalViews || 0),
        avgViews: Number(r.avgViews || 0),
        viralVideoCount: Number(r.viralVideoCount || 0),
        isActive: true,
        lastSyncedAt: r.lastSyncedAt
      }))
      allChannels.push(...youtubeChannels)
    } catch (e) {
      console.error('Failed to load YouTube channels:', e)
    }
    
    // Load Instagram profiles
    try {
      const res = await fetch(`/api/channels/instagram?${params.toString()}`)
      const data = await res.json()
      const rows = Array.isArray(data?.rows) ? data.rows : []
      const active = rows.filter((r: any) => r.isActive)
      const instagramProfiles: PlatformChannel[] = active.map((r: any) => ({
        platform: 'instagram' as const,
        id: r.id,
        title: r.title,
        handle: r.handle || "",
        followerCount: Number(r.followerCount || 0),
        thumbnailUrl: r.thumbnailUrl || "/placeholder.svg",
        postCount: Number(r.postCount || 0),
        totalLikes: Number(r.totalLikes || 0),
        avgLikes: Number(r.avgLikes || 0),
        viralPostCount: Number(r.viralPostCount || 0),
        isActive: true,
        lastSyncedAt: r.lastSyncedAt
      }))
      allChannels.push(...instagramProfiles)
    } catch (e) {
      console.error('Failed to load Instagram profiles:', e)
    }
    
    setChannels(allChannels)
  }

  useEffect(() => {
    loadChannels()
  }, [criteria.viralMultiplier, criteria.timeRange])

  async function addChannel() {
    // Auto-detect platform from URL, fallback to selected platform
    const detectedPlatform = getPlatformFromUrl(newChannelUrl) || selectedPlatform
    const handle = extractHandle(newChannelUrl, detectedPlatform)
    
    if (!handle) {
      alert('Invalid URL or handle format')
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch(`/api/channels/${detectedPlatform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Add failed")
      }
      setNewChannelUrl("")
      await loadChannels()
    } catch (e: any) {
      alert(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function removeChannel(id: string) {
    const channel = channels.find(c => c.id === id)
    if (!channel) return
    
    setLoading(true)
    try {
      await fetch(`/api/channels/${channel.platform}/${id}`, { method: "DELETE" })
      await loadChannels()
    } finally {
      setLoading(false)
    }
  }

  async function resyncChannel(handle: string) {
    const channel = channels.find(c => c.handle === handle)
    if (!channel) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({ handle, sinceDays: String(36500) })
      const res = await fetch(`/api/sync/${channel.platform}?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Re-Sync failed')
      }
      await loadChannels()
    } catch (e: any) {
      alert(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleCriteriaChange = (field: string, value: number | string) => {
    const newCriteria = { ...criteria, [field]: value }
    setCriteria(newCriteria)
    if (typeof window !== 'undefined') {
      localStorage.setItem('platform-global-criteria', JSON.stringify(newCriteria))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Multi-Platform Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track and analyze your favorite YouTube channels and Instagram profiles</p>
        </div>

        <Tabs defaultValue="channels" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-72">
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="criteria">
              <Settings className="h-4 w-4 mr-2" />
              Criteria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-6">

            {/* Add Channel Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Channel/Profile
                </CardTitle>
                <CardDescription>
                  Enter a YouTube channel or Instagram profile URL to start tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Select value={selectedPlatform} onValueChange={(value: Platform) => setSelectedPlatform(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4" />
                            YouTube
                          </div>
                        </SelectItem>
                        <SelectItem value="instagram">
                          <div className="flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            Instagram
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={selectedPlatform === 'youtube' 
                        ? "https://youtube.com/@channelname or @channelname"
                        : "https://instagram.com/username or @username"
                      }
                      value={newChannelUrl}
                      onChange={(e) => setNewChannelUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={addChannel} disabled={loading}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add {selectedPlatform === 'youtube' ? 'Channel' : 'Profile'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Platform will be auto-detected from URL, or use the dropdown to select manually
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tracked Channels */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">Tracked Channels ({channels.length})</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {channels.map((channel) => (
                <PlatformChannelCard
                  key={channel.id}
                  channel={channel}
                  onRemove={removeChannel}
                  onResync={resyncChannel}
                  loading={loading}
                />
              ))}
            </div>

            {channels.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No channels tracked yet</h3>
                  <p className="text-muted-foreground text-center">
                    Add your first YouTube channel or Instagram profile to start analyzing performance metrics
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="criteria" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Global Analytics Criteria
                </CardTitle>
                <CardDescription>
                  Set global criteria for viral video detection and engagement scoring across all channels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Viral Video Criteria */}
                  <Card className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <h3 className="font-semibold">Viral Video Threshold</h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="viral-multiplier">
                          Viral Multiplier
                        </Label>
                        <div className="flex items-center gap-3">
                          <Input
                            id="viral-multiplier"
                            type="number"
                            min="1"
                            max="100"
                            step="0.5"
                            value={criteria.viralMultiplier}
                            onChange={(e) => handleCriteriaChange('viralMultiplier', parseFloat(e.target.value) || 5)}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">
                            x subscriber count
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Videos need {criteria.viralMultiplier}x+ more views than subscriber count to be considered viral
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Engagement Weights */}
                  <Card className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <h3 className="font-semibold">Engagement Weights</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="comment-weight" className="flex items-center gap-2">
                            <MessageCircle className="h-3 w-3" />
                            Comment Weight
                          </Label>
                          <div className="flex items-center gap-3">
                            <Input
                              id="comment-weight"
                              type="number"
                              min="0"
                              max="10000"
                              step="10"
                              value={criteria.commentWeight}
                              onChange={(e) => handleCriteriaChange('commentWeight', parseFloat(e.target.value) || 500)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">
                              points per comment
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="like-weight" className="flex items-center gap-2">
                            <Heart className="h-3 w-3" />
                            Like Weight
                          </Label>
                          <div className="flex items-center gap-3">
                            <Input
                              id="like-weight"
                              type="number"
                              min="0"
                              max="10000"
                              step="10"
                              value={criteria.likeWeight}
                              onChange={(e) => handleCriteriaChange('likeWeight', parseFloat(e.target.value) || 150)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">
                              points per like
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Time Range */}
                  <Card className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <h3 className="font-semibold">Time Range</h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="time-range" className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Analysis Period
                        </Label>
                        <Select 
                          value={criteria.timeRange} 
                          onValueChange={(value) => handleCriteriaChange('timeRange', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select time range" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_RANGES.map((range) => (
                              <SelectItem key={range.value} value={range.value}>
                                {range.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Analysis includes videos from the last {TIME_RANGES.find(r => r.value === criteria.timeRange)?.label.toLowerCase() || 'period'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Preview Section */}
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Preview</CardTitle>
                    <CardDescription>
                      How your criteria affects analysis across all channels
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Viral Video Detection</h4>
                        <p className="text-sm text-muted-foreground">
                          A channel with 100K subscribers needs <strong>{formatNumber(100000 * criteria.viralMultiplier)}</strong> views 
                          for a video to be considered viral
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Engagement Score Example</h4>
                        <p className="text-sm text-muted-foreground">
                          1K views + 100 comments + 50 likes = 
                          <strong> {formatNumber(1000 + (100 * criteria.commentWeight) + (50 * criteria.likeWeight))}</strong> points
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reset Button */}
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const defaultCriteria = { viralMultiplier: 5, commentWeight: 500, likeWeight: 150, timeRange: '90' }
                      setCriteria(defaultCriteria)
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('youtube-global-criteria', JSON.stringify(defaultCriteria))
                      }
                    }}
                  >
                    Reset to Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
