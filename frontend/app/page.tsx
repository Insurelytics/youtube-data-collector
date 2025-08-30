"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, TrendingUp, Users, Eye, MessageCircle, Heart, ExternalLink, RefreshCcw, Settings, Flame, Clock, Loader2, Mail, Save, Zap, User, Play } from 'lucide-react'
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { JobsMonitor } from "@/components/jobs/JobsMonitor"

type UiChannel = {
  id: string
  name: string
  handle: string
  subscribers: number
  avatar: string
  totalVideos: number
  totalViews: number
  avgViews: number
  viralVideos: number
  platform: string
}



function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toFixed(0).toString()
}

function extractHandle(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  
  // Handle @ prefixed usernames
  if (trimmed.startsWith("@")) return trimmed
  
  try {
    const url = new URL(trimmed)
    const seg = url.pathname.split("/").filter(Boolean).pop() || ""
    
    // For Instagram and YouTube URLs, return the username/channel name directly
    if (url.hostname.includes('instagram.com') || url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      return seg || ""
    }
    
    // For other URLs, only return if it starts with @
    return seg.startsWith("@") ? seg : ""
  } catch {
    // If not a valid URL, might be a plain username
    return trimmed.match(/^[a-zA-Z0-9._]+$/) ? trimmed : ""
  }
}

function detectPlatform(url: string): "instagram" | "youtube" | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const urlObj = new URL(trimmed)
    const hostname = urlObj.hostname.toLowerCase()

    if (hostname.includes('instagram.com')) {
      return 'instagram'
    } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'youtube'
    }
  } catch {
    // Not a valid URL, check for handle patterns
    if (trimmed.startsWith('@')) {
      return null // Can't determine platform from just a handle
    }
  }

  return null
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
    timeRange: '90'
  }
}

function getScheduleSettings() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('youtube-schedule-settings')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {}
    }
  }
  return {
    scrapeFrequency: "daily",
    emailNotifications: true,
    emailAddresses: "user@example.com",
    maxVideosPerEmail: "10",
    sendTime: "09:00",
  }
}

type LoadingState = {
  type: 'adding' | 'syncing' | 'removing' | null
  channelId?: string
  message?: string
}

export default function HomePage() {
  const [channels, setChannels] = useState<UiChannel[]>([])
  const [newChannelUrl, setNewChannelUrl] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState<"instagram" | "youtube">("instagram")
  const [loadingState, setLoadingState] = useState<LoadingState>({ type: null })
  const [criteria, setCriteria] = useState(getGlobalCriteria())
  const [scheduleSettings, setScheduleSettings] = useState(getScheduleSettings())
  const { toast } = useToast()

  async function loadChannels() {
    try {
      const params = new URLSearchParams({
        viralMultiplier: criteria.viralMultiplier.toString(),
        days: criteria.timeRange
      })
      const res = await fetch(`/api/channels?${params.toString()}`)
      
      if (!res.ok) {
        console.warn('Failed to load channels:', res.status, res.statusText)
        // Don't throw error - just log it and use empty array
        setChannels([])
        return
      }
      
      const data = await res.json()
      const rows = Array.isArray(data?.rows) ? data.rows : []
      const active = rows.filter((r: any) => r.isActive)
      const mapped: UiChannel[] = active.map((r: any) => ({
        id: r.id,
        name: r.title,
        handle: r.handle || "",
        subscribers: Number(r.subscriberCount || 0),
        avatar: r.thumbnailUrl || "/placeholder.svg?height=40&width=40&text=CH",
        totalVideos: Number(r.videoCount || 0),
        totalViews: Number(r.totalViews || 0),
        avgViews: Number(r.avgViews || 0),
        viralVideos: Number(r.viralVideoCount || 0),
        platform: r.platform || 'youtube',
      }))
      setChannels(mapped)
    } catch (error) {
      console.warn('Error loading channels:', error)
      // Don't show error to user - just silently fail and keep existing channels
      // This prevents errors from breaking the channel addition flow
    }
  }

  useEffect(() => {
    loadChannels()
  }, [criteria.viralMultiplier, criteria.timeRange])

  async function addChannel() {
    const handle = extractHandle(newChannelUrl)
    if (!handle) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid channel URL or handle.",
        variant: "destructive"
      })
      return
    }

    const isInstagram = selectedPlatform === 'instagram'
    const estimatedTime = isInstagram ? '2-3 minutes' : '30 seconds'
    
    setLoadingState({
      type: 'adding',
      message: `Adding ${handle} (${selectedPlatform})...`
    })

    toast({
      title: `Adding ${selectedPlatform} channel`,
      description: `Scraping data for ${handle}. This may take ${estimatedTime}...`
    })

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, platform: selectedPlatform }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Add failed")
      }

      const result = await res.json()
      setNewChannelUrl("")
      
      // Add a small delay to ensure the database transaction is committed
      // before refreshing the channel list
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadChannels()

      toast({
        title: "Channel added successfully!",
        description: `${handle} has been added with ${result.count || 0} posts.`
      })

    } catch (e: any) {
      console.error('Add channel error:', e)
      toast({
        title: "Failed to add channel",
        description: e?.message || "An unexpected error occurred. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoadingState({ type: null })
    }
  }

  async function removeChannel(id: string) {
    setLoadingState({ type: 'removing', channelId: id, message: 'Removing channel...' })
    try {
      await fetch(`/api/channels/${id}`, { method: "DELETE" })
      await loadChannels()
      toast({
        title: "Channel removed",
        description: "Channel has been successfully removed."
      })
    } catch (e: any) {
      toast({
        title: "Failed to remove channel",
        description: e?.message || "An unexpected error occurred.",
        variant: "destructive"
      })
    } finally {
      setLoadingState({ type: null })
    }
  }

  async function resyncChannel(handle: string, platform: string = 'youtube') {
    const isInstagram = platform === 'instagram'
    const estimatedTime = isInstagram ? '2-3 minutes' : '30 seconds'
    
    // Find the channel ID for this handle to track which specific channel is syncing
    const channel = channels.find(c => c.handle === handle)
    const channelId = channel?.id
    
    setLoadingState({
      type: 'syncing',
      channelId: channelId, // Track which specific channel is syncing
      message: `Syncing ${handle} (${platform})...`
    })

    toast({
      title: `Re-syncing ${platform} channel`,
      description: `Updating data for ${handle}. This may take ${estimatedTime}...`
    })

    try {
      const params = new URLSearchParams({ handle, platform, sinceDays: String(36500) })
      const res = await fetch(`/api/sync?${params.toString()}`)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Re-Sync failed')
      }

      const result = await res.json()
      await loadChannels()

      toast({
        title: "Sync completed!",
        description: `${handle} updated with ${result.count || 0} posts.`
      })
    } catch (e: any) {
      console.error('Resync error:', e)
      toast({
        title: "Sync failed",
        description: e?.message || "An unexpected error occurred during sync.",
        variant: "destructive"
      })
    } finally {
      setLoadingState({ type: null })
    }
  }

  const handleUrlChange = (url: string) => {
    setNewChannelUrl(url)
    // Auto-detect platform from URL
    const detectedPlatform = detectPlatform(url)
    if (detectedPlatform) {
      setSelectedPlatform(detectedPlatform)
    }
  }

  const handleCriteriaChange = (field: string, value: number | string) => {
    const newCriteria = { ...criteria, [field]: value }
    setCriteria(newCriteria)
    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-global-criteria', JSON.stringify(newCriteria))
    }
  }

  const handleScheduleChange = (field: string, value: string | boolean) => {
    const newSettings = { ...scheduleSettings, [field]: value }
    setScheduleSettings(newSettings)
    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-schedule-settings', JSON.stringify(newSettings))
    }
  }

  const handleSaveSchedule = () => {
    // TODO: Implement backend API call to save schedule settings
    console.log("Schedule settings saved:", scheduleSettings)
    toast({
      title: "Settings saved",
      description: "Your schedule settings have been saved successfully."
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Social Media Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track and analyze Instagram and YouTube channels</p>
        </div>

        <Tabs defaultValue="channels" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="channels">
              <User className="h-4 w-4 mr-2" />
              Channels
            </TabsTrigger>
            
            <TabsTrigger value="criteria">
              <Settings className="h-4 w-4 mr-2" />
              Criteria
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Play className="h-4 w-4 mr-2" />
              Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-6">

            {/* Add Channel Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Channel
                </CardTitle>
                <CardDescription>
                  Enter a social media profile URL to start tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Select value={selectedPlatform} onValueChange={(value: "instagram" | "youtube") => setSelectedPlatform(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={selectedPlatform === 'instagram'
                        ? "https://instagram.com/username or username"
                        : "https://youtube.com/@channelname or @channelname"}
                      value={newChannelUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={addChannel} disabled={loadingState.type === 'adding'}>
                      {loadingState.type === 'adding' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      {loadingState.type === 'adding' ? 'Adding...' : 'Add Channel'}
                    </Button>
                  </div>
                  
                  {/* Loading state display */}
                  {loadingState.type === 'adding' && (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertTitle>Scraping in progress</AlertTitle>
                      <AlertDescription>
                        {loadingState.message}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    {selectedPlatform === 'instagram'
                      ? "Enter an Instagram profile URL or username. Scraping may take 2-3 minutes."
                      : "Enter a YouTube channel URL or handle."}
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
            <Card key={channel.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={channel.avatar || "/placeholder.svg"} alt={channel.name} />
                      <AvatarFallback>{channel.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{channel.name}</CardTitle>
                      <CardDescription>{channel.handle}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Re-Sync"
                      disabled={loadingState.type === 'syncing' || loadingState.type === 'adding'}
                      onClick={() => channel.handle && resyncChannel(channel.handle, channel.platform)}
                    >
                      {loadingState.type === 'syncing' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeChannel(channel.id)}
                      className="text-destructive hover:text-destructive"
                      title="Remove"
                      disabled={loadingState.type === 'removing' && loadingState.channelId === channel.id}
                    >
                      {loadingState.type === 'removing' && loadingState.channelId === channel.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{formatNumber(channel.subscribers)} subs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span>{formatNumber(channel.totalViews)} views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span>{channel.totalVideos} videos synced</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>{channel.viralVideos} viral</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <Badge variant="secondary" className="text-xs">
                    {formatNumber(channel.avgViews)} avg views
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {channel.platform}
                  </Badge>
                </div>
                
                {/* Show loading state for this specific channel only */}
                {loadingState.type === 'syncing' && loadingState.channelId === channel.id && (
                  <Alert className="mt-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      {loadingState.message}
                    </AlertDescription>
                  </Alert>
                )}
                <Link href={`/dashboard/${channel.id}`}>
                  <Button className="w-full">
                    View Dashboard
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
              ))}
            </div>

            {channels.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No channels tracked yet</h3>
                  <p className="text-muted-foreground text-center">
                    Add your first YouTube channel to start analyzing performance metrics
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6">
            <JobsMonitor />
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
                            x average views
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Videos need {criteria.viralMultiplier}x+ more views than average views to be considered viral
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
                          A channel with 10K average views needs <strong>{formatNumber(10000 * criteria.viralMultiplier)}</strong> views 
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

          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Scrape Schedule Settings
                </CardTitle>
                <CardDescription>
                  Configure how often to check for new content and when to send email notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                  {/* Scraping Frequency */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Data Scraping Frequency
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="scrape-frequency">Check Frequency</Label>
                        <Select
                          value={scheduleSettings.scrapeFrequency}
                          onValueChange={(value) => handleScheduleChange("scrapeFrequency", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="2days">Every 2 Days</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Email Notifications */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Viral Video Notifications
                      </CardTitle>
                      <CardDescription>Get notified when videos go viral (exceed {criteria.viralMultiplier}x average views)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Enable Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">Receive emails when viral videos are detected</p>
                        </div>
                        <Switch
                          checked={scheduleSettings.emailNotifications}
                          onCheckedChange={(checked) => handleScheduleChange("emailNotifications", checked)}
                        />
                      </div>

                      {scheduleSettings.emailNotifications && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Addresses</Label>
                            <Input
                              id="email"
                              type="text"
                              value={scheduleSettings.emailAddresses}
                              onChange={(e) => handleScheduleChange("emailAddresses", e.target.value)}
                              placeholder="email1@example.com, email2@example.com"
                            />
                            <p className="text-xs text-muted-foreground">Separate multiple email addresses with commas</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="max-videos">Max Videos Per Email</Label>
                            <Select
                              value={scheduleSettings.maxVideosPerEmail}
                              onValueChange={(value) => handleScheduleChange("maxVideosPerEmail", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select max videos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5 videos</SelectItem>
                                <SelectItem value="10">10 videos</SelectItem>
                                <SelectItem value="15">15 videos</SelectItem>
                                <SelectItem value="20">20 videos</SelectItem>
                                <SelectItem value="unlimited">Unlimited</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Email Send Time */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Email Send Time
                      </CardTitle>
                      <CardDescription>What time of day should we send your email notifications?</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label htmlFor="send-time">Preferred Send Time</Label>
                        <Input
                          id="send-time"
                          type="time"
                          value={scheduleSettings.sendTime}
                          onChange={(e) => handleScheduleChange("sendTime", e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <Button onClick={handleSaveSchedule} className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save Settings
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
