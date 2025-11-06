"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, TrendingUp, Users, Eye, Flame, ExternalLink, RefreshCcw, Loader2, File } from 'lucide-react'
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useJobs } from "@/hooks/useJobs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

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
    const parts = url.pathname.split("/").filter(Boolean)
    // For Instagram profile URLs, the first segment is the username
    if (url.hostname.includes('instagram.com')) {
      const first = parts[0] || ""
      return first || ""
    }
    // For YouTube, return the last relevant segment /@handle etc.
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const seg = parts.pop() || ""
      return seg || ""
    }
    
    // For other URLs, do not infer a handle
    return ""
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

type LoadingState = {
  type: 'adding' | 'syncing' | 'removing' | 'addingToSheet' | null
  channelId?: string
  message?: string
}

export function ChannelsPage() {
  const [channels, setChannels] = useState<UiChannel[]>([])
  const [newChannelUrl, setNewChannelUrl] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState<"instagram" | "youtube">("instagram")
  const [loadingState, setLoadingState] = useState<LoadingState>({ type: null })
  const [showSheetDialog, setShowSheetDialog] = useState(false)
  const [criteria] = useState(getGlobalCriteria())
  const { toast } = useToast()
  const { runningJobs } = useJobs()
  const router = useRouter()
  const initialScrapeJobs = runningJobs.filter(j => j.type.includes('Initial Scrape'))

  // Simple ETA: 20 minutes per initial scrape job, minus progress on the active one
  const etaMinutes = (() => {
    const total = initialScrapeJobs.length * 20
    const active = initialScrapeJobs.find(j => j.status === 'running')
    if (active && typeof active.progressCurrent === 'number' && typeof active.progressTotal === 'number' && active.progressTotal > 0) {
      const completedSteps = Math.min(Math.max(active.progressCurrent, 0), active.progressTotal)
      const subtract = (completedSteps / active.progressTotal) * 20
      return Math.max(0, Math.round(total - subtract))
    }
    return total
  })()

  async function loadChannels() {
    try {
      const params = new URLSearchParams({
        viralMultiplier: criteria.viralMultiplier.toString(),
        days: criteria.timeRange
      })
      const res = await fetch(`/api/channels?${params.toString()}`)
      
      if (!res.ok) {
        console.warn('Failed to load channels:', res.status, res.statusText)
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
        platform: r.platform,
      }))
      setChannels(mapped)
    } catch (error) {
      console.warn('Error loading channels:', error)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [criteria.viralMultiplier, criteria.timeRange])

  async function waitForChannelToAppear(handle: string, platform: string, maxWaitTime = 120000) {
    const channelId = platform === 'instagram' ? `ig_${handle}` : handle
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      await loadChannels()
      
      const foundChannel = channels.find(ch => ch.id === channelId)
      if (foundChannel) {
        return foundChannel
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    return null
  }

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

    const estimatedTime = '15-30 minutes'
    
    setLoadingState({
      type: 'adding',
      message: `Adding ${handle} (${selectedPlatform})...`
    })

    toast({
      title: `Adding ${selectedPlatform} channel`,
      description: `Getting channel info for ${handle}. This may take ${estimatedTime}...`
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

      setNewChannelUrl("")
      
      setLoadingState({
        type: 'adding',
        message: `Channel job created, waiting for ${handle} to appear in database...`
      })

      const foundChannel = await waitForChannelToAppear(handle, selectedPlatform)
      
      if (foundChannel) {
        toast({
          title: "Channel added successfully!",
          description: `${foundChannel.name} has been added.`
        })
      } else {
        toast({
          title: "Channel added",
          description: `${handle} is being processed in the background. It should appear shortly.`
        })
      }

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

  async function resyncChannel(handle: string, platform: string) {
    const isInstagram = platform === 'instagram'
    const estimatedTime = '15-30 minutes'
    
    const channel = channels.find(c => c.handle === handle)
    const channelId = channel?.id
    
    setLoadingState({
      type: 'syncing',
      channelId: channelId,
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

      await loadChannels()

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

  // moved to dashboard page

  async function addToSheet(channelId: string) {
    const ch = channels.find(c => c.id === channelId);
    if (!ch) return;
    setLoadingState({ type: 'addingToSheet', channelId, message: `Adding ${ch.name} to sheet...` });
    try {
      const res = await fetch('/api/drive/add-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorMsg = err?.error || 'Failed to add to sheet';
        throw new Error(errorMsg);
      }
      const data = await res.json();
      if (data.added) {
        toast({
          title: "Channel added to sheet",
          description: `${ch.name} has been added to the spreadsheet.`
        });
      } else if (data.updated) {
        toast({
          title: "Channel updated in sheet",
          description: `Subscribers for ${ch.name} have been updated.`
        });
      } else {
        toast({
          title: "Channel up to date",
          description: data.message || "No changes needed."
        });
      }
    } catch (e: any) {
      const errorMsg = e?.message || "An unexpected error occurred.";
      toast({
        title: "Failed to update sheet",
        description: errorMsg,
        variant: "destructive"
      });
      if (errorMsg.includes('spreadsheetId not set')) {
        setShowSheetDialog(true);
      }
    } finally {
      setLoadingState({ type: null });
    }
  }

  const handleUrlChange = (url: string) => {
    setNewChannelUrl(url)
    const detectedPlatform = detectPlatform(url)
    if (detectedPlatform) {
      setSelectedPlatform(detectedPlatform)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Channel Section */}
      <div className="mb-3">
          <h1 className="text-2xl font-semibold">Add and Manage Channels</h1>
          <p className="text-md text-muted-foreground">Add new channels to track and manage your tracked channels</p>
        </div>
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
              <Button onClick={addChannel}>
                {loadingState.type === 'adding' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {loadingState.type === 'adding' ? 'Adding...' : 'Add Channel'}
              </Button>
            </div>

            {initialScrapeJobs.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Running initial scrapes</div>
                <div className="space-y-1">
                  {initialScrapeJobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between text-sm rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="font-medium">{job.channelName}</span>
                        <Badge variant="outline" className="capitalize">{job.type.replace(' Initial Scrape','')}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">initial scrape</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {selectedPlatform === 'instagram'
                ? `Enter an Instagram profile URL or username. ${initialScrapeJobs.length > 0 ? `Estimated time remaining: ~${etaMinutes} minutes.` : 'Scraping may take 15-30 minutes.'}`
                : `Enter a YouTube channel URL or handle. ${initialScrapeJobs.length > 0 ? `Estimated time remaining: ~${etaMinutes} minutes.` : 'Scraping may take 15-30 minutes.'}`}
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
                  {/* Generate Recommendations button moved to channel dashboard */}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Re-Sync"
                    disabled={loadingState.type === 'syncing' || loadingState.type === 'adding' || loadingState.type === 'addingToSheet'}
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
                    title="Add to 10X10"
                    disabled={loadingState.type === 'addingToSheet' && loadingState.channelId === channel.id || loadingState.type === 'syncing' || loadingState.type === 'adding'}
                    onClick={() => addToSheet(channel.id)}
                  >
                    {loadingState.type === 'addingToSheet' && loadingState.channelId === channel.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <File className="h-4 w-4" />
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
      <AlertDialog open={showSheetDialog} onOpenChange={setShowSheetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Spreadsheet Connected</AlertDialogTitle>
            <AlertDialogDescription>
              To add channels to a sheet, please set up a Google Spreadsheet connection in the Drive settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { router.push('/drive'); setShowSheetDialog(false); }}>Take Me to Setup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
