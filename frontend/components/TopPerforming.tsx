"use client"

import { useState, useEffect } from "react"
import { Grid3X3, Flame, ChevronDown, LinkIcon, HelpCircle, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { VideoCard } from "./VideoCard"
import { getPostUrl, formatNumber } from "@/lib/video-utils"

// Type definitions
type Topic = {
  id: number
  topic: string
  engagementMultiplier: number
  videoCount: number
  category: string
  categoryColor?: string
  group: string
  description: string
  topVideos?: any[]
  isCategory?: boolean
  incomingCategoryConnections?: string[]
  outgoingConnections?: Array<{
    targetTopic: string
    strength: number
  }>
}

type Relationship = {
  source: number
  target: number
  strength: number
  label: string
  forwardStrength?: number
  reverseStrength?: number
}

export default function TopPerforming() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [maxNodes, setMaxNodes] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('topicMaxNodes')
      return saved ? Number(saved) : 40
    }
    return 40
  })
  const [inputValue, setInputValue] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('topicMaxNodes')
      return saved ? Number(saved) : 40
    }
    return 40
  })

  const [addingVideoId, setAddingVideoId] = useState<string | null>(null)
  const [showAddChannelDialog, setShowAddChannelDialog] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<any | null>(null)
  const [addedVideos, setAddedVideos] = useState<Set<string>>(new Set())
  const [sheetUrl, setSheetUrl] = useState<string | null>(null)
  const { toast } = useToast()

  // Sync input value when maxNodes changes
  useEffect(() => {
    setInputValue(maxNodes)
  }, [maxNodes])

  // Save maxNodes to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('topicMaxNodes', maxNodes.toString())
    }
  }, [maxNodes])

  // Fetch data from API
  useEffect(() => {
    const fetchTopicGraph = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/topics/graph?maxNodes=${maxNodes}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        
        if (data.topics && data.relationships) {
          setTopics(data.topics)
          setRelationships(data.relationships)
        }
      } catch (err) {
        console.error('Failed to fetch topic graph:', err)
        setError(err instanceof Error ? err.message : 'Failed to load topic data')
      } finally {
        setLoading(false)
      }
    }

    fetchTopicGraph()
  }, [maxNodes])

  const formatMultiplier = (multiplier: number) => {
    return `${multiplier.toFixed(1)}x`
  }

  const getCategoryColorClass = (categoryColor?: string) => {
    if (!categoryColor) {
      return "bg-slate-100 text-slate-800 border-slate-200"
    }
    return "" // Return empty string when using custom styles
  }

  const getCategoryColorStyle = (categoryColor?: string) => {
    if (!categoryColor) {
      return {}
    }
    
    // Use the categoryColor from backend with light background and dark text
    const lightColor = categoryColor + "20" // Add 20 for transparency
    const darkColor = categoryColor + "CC" // Add CC for darker version
    
    return {
      backgroundColor: lightColor,
      color: darkColor,
      borderColor: categoryColor + "40"
    }
  }

  const getProgressValue = (multiplier: number) => {
    // Scale: 0.33 = 0%, 1.0 = 50%, 3.0 = 100%
    const min = 0.33
    const center = 1.0
    const max = 3.0
    
    if (multiplier <= center) {
      // Scale from 0-50% for 0.33-1.0 range
      return Math.max(0, ((multiplier - min) / (center - min)) * 50)
    } else {
      // Scale from 50-100% for 1.0-3.0 range
      return Math.min(100, 50 + ((multiplier - center) / (max - center)) * 50)
    }
  }

  const getTopConnections = (topicId: number) => {
    const topic = topics.find((t) => t.id === topicId)
    if (!topic || !topic.outgoingConnections) return []
    
    return topic.outgoingConnections
      .map((conn) => ({
        topic: conn.targetTopic,
        strength: conn.strength,
        label: `Connected to ${conn.targetTopic}`
      }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3)
  }

  const getMultiplierColorClass = (multiplier: number) => {
    // Color based on engagement performance for text
    if (multiplier >= 1.8) return "text-emerald-600"
    if (multiplier >= 1.5) return "text-green-600"
    if (multiplier >= 1.2) return "text-lime-600"
    if (multiplier >= 1.05) return "text-yellow-600"
    if (multiplier >= 0.95) return "text-yellow-600"
    if (multiplier >= 0.8) return "text-orange-600"
    return "text-red-600"
  }

  async function addToSheet(video: any) {
    if (!video.channelId) {
      toast({ title: "Error", description: "Missing channel information", variant: "destructive" });
      return;
    }
    setAddingVideoId(video.id)
    try {
      const videoLink = getPostUrl(video)
      const res = await fetch('/api/drive/add-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: video.channelId,
          videoLink,
          viewCount: video.views || 0
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const errorMsg = err?.error || 'Failed to add to sheet'
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
    if (!pendingVideo) return
    setShowAddChannelDialog(false)
    setAddingVideoId(pendingVideo.id)
    try {
      const channelRes = await fetch('/api/drive/add-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: pendingVideo.channelId })
      })
      if (!channelRes.ok) {
        const err = await channelRes.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to add channel')
      }
      toast({
        title: "Channel added to 10X10",
        description: `${pendingVideo.channelTitle} has been added to the spreadsheet`
      })
      const videoLink = getPostUrl(pendingVideo)
      const reelRes = await fetch('/api/drive/add-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: pendingVideo.channelId,
          videoLink,
          viewCount: pendingVideo.views || 0
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Top Performing Topics</h2>
            <p className="text-muted-foreground">Loading topic data...</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading topics...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Top Performing Topics</h2>
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Top Performing Topics</h2>
          <p className="text-muted-foreground">
            Detailed analysis of topic performance based on engagement metrics
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="maxNodes" className="text-sm font-medium">Max Topics:</Label>
          <input
            id="maxNodes"
            type="number"
            min={1}
            max={500}
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setInputValue(Number(e.target.value));
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                const value = Math.max(1, Math.min(500, inputValue));
                setMaxNodes(value);
              }
            }}
            onBlur={() => {
              const value = Math.max(1, Math.min(500, inputValue));
              setMaxNodes(value);
            }}
            className="w-24 border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* Empty State */}
      {topics.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Flame className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Topic Analytics Available</h3>
            <p className="text-muted-foreground text-center">
              There are not enough videos in the database to display topic analytics. Add more channels and let them sync to see trending topics.
            </p>
          </CardContent>
        </Card>
      )}

      {topics.length > 0 && (
        <>
          {/* High Impact Topics Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-6 w-6 text-orange-500" />
              <h2 className="text-2xl font-semibold">High Impact Topics</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" align="start">
                  <div className="space-y-3 text-sm">
                    <h4 className="font-semibold">How Topic Analysis Works</h4>
                    <p>
                      <strong>Engagement Multiplier:</strong> Shows how much better (or worse) videos with this topic perform compared to the average. 
                      For example, a 2.5x multiplier means videos with this topic get 2.5 times more engagement than typical videos from the same channel.
                    </p>
                    <p>
                      <strong>How it's calculated:</strong> We compare each video's likes, comments, and views to other videos from the same creator, 
                      then average the results for all videos tagged with that topic. This accounts for different channel sizes and audiences.
                    </p>
                    <p>
                      <strong>Topic Connections:</strong> Shows which topics frequently appear together in the same videos, helping you understand 
                      content clusters and cross-topic opportunities.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {topics
                .sort((a, b) => b.engagementMultiplier - a.engagementMultiplier)
                .slice(0, 2)
                .map((topic) => {
                  const topConnections = getTopConnections(topic.id)

                  return (
                    <Card
                      key={topic.id}
                      className="relative overflow-hidden border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50"
                    >
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-orange-500 text-white">
                          <Flame className="h-3 w-3 mr-1" />
                          Hot
                        </Badge>
                      </div>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-xl">{topic.topic}</CardTitle>
                            <CardDescription className="mt-1">{topic.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={getCategoryColorClass(topic.categoryColor)}
                            style={getCategoryColorStyle(topic.categoryColor)}
                          >
                            {topic.category}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Engagement Multiplier</span>
                              <span className="font-semibold text-green-600">
                                {formatMultiplier(topic.engagementMultiplier)}
                              </span>
                            </div>
                            <Progress value={getProgressValue(topic.engagementMultiplier)} className="h-2" />
                            <div className="text-xs text-muted-foreground mt-1">
                              {topic.engagementMultiplier >= 1.8
                                ? "Excellent"
                                : topic.engagementMultiplier >= 1.5
                                  ? "Very Good"
                                  : topic.engagementMultiplier >= 1.2
                                    ? "Good"
                                    : topic.engagementMultiplier >= 1.05
                                      ? "Above Average"
                                      : topic.engagementMultiplier >= 0.95
                                        ? "Average"
                                        : topic.engagementMultiplier >= 0.8
                                          ? "Below Average"
                                          : "Poor"}
                            </div>
                          </div>

                          <div className="text-sm">
                            <span className="text-muted-foreground">{topic.videoCount} videos</span>
                          </div>

                          {/* Top Videos Dropdown */}
                          {topic.topVideos && topic.topVideos.length > 0 && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full justify-between bg-transparent">
                                  <div className="flex items-center gap-2">
                                    <Video className="h-3 w-3" />
                                    Top 3 Videos
                                  </div>
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 mt-2">
                                {topic.topVideos.map((video, index) => (
                                  <VideoCard
                                    key={index}
                                    video={video}
                                    variant="compact"
                                    isAdded={addedVideos.has(video.id)}
                                    isLoading={addingVideoId === video.id}
                                    onAdd={() => addToSheet(video)}
                                    sheetUrl={sheetUrl}
                                  />
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          )}

                          {/* Top Connections Dropdown */}
                          {topConnections.length > 0 && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full justify-between bg-transparent">
                                  <div className="flex items-center gap-2">
                                    <LinkIcon className="h-3 w-3" />
                                    Top 3 Connections
                                  </div>
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 mt-2">
                                {topConnections.map((connection, index) => (
                                  <div key={index} className="p-2 bg-muted/30 rounded text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium">{connection?.topic}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {((connection?.strength || 0) * 100).toFixed(0)}%
                                      </Badge>
                                    </div>
                                    <div className="text-muted-foreground">{connection?.label}</div>
                                  </div>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </div>

          {/* All Topics Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Grid3X3 className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-semibold">All Topics</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topics
                .sort((a, b) => b.engagementMultiplier - a.engagementMultiplier)
                .map((topic) => {
                const topConnections = getTopConnections(topic.id)

                return (
                  <Card key={topic.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{topic.topic}</CardTitle>
                        <Badge 
                          variant="outline" 
                          className={getCategoryColorClass(topic.categoryColor)}
                          style={getCategoryColorStyle(topic.categoryColor)}
                        >
                          {topic.category}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">{topic.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Engagement Multiplier</span>
                          <span
                            className={`font-semibold ${getMultiplierColorClass(topic.engagementMultiplier)}`}
                          >
                            {formatMultiplier(topic.engagementMultiplier)}
                          </span>
                        </div>
                        <Progress value={getProgressValue(topic.engagementMultiplier)} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1">
                          {topic.engagementMultiplier >= 1.8
                            ? "Excellent"
                            : topic.engagementMultiplier >= 1.5
                              ? "Very Good"
                              : topic.engagementMultiplier >= 1.2
                                ? "Good"
                                : topic.engagementMultiplier >= 1.05
                                  ? "Above Average"
                                  : topic.engagementMultiplier >= 0.95
                                    ? "Average"
                                    : topic.engagementMultiplier >= 0.8
                                      ? "Below Average"
                                      : "Poor"}
                        </div>
                      </div>

                      <div className="text-sm">
                        <span className="text-muted-foreground">{topic.videoCount} videos</span>
                      </div>

                      {/* Top Videos Dropdown */}
                      {topic.topVideos && topic.topVideos.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-between bg-transparent">
                              <div className="flex items-center gap-2">
                                <Video className="h-3 w-3" />
                                Top 3 Videos
                              </div>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 mt-2">
                            {topic.topVideos.map((video, index) => (
                              <VideoCard
                                key={index}
                                video={video}
                                variant="compact"
                                isAdded={addedVideos.has(video.id)}
                                isLoading={addingVideoId === video.id}
                                onAdd={() => addToSheet(video)}
                                sheetUrl={sheetUrl}
                              />
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Top Connections Dropdown */}
                      {topConnections.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-between bg-transparent">
                              <div className="flex items-center gap-2">
                                <LinkIcon className="h-3 w-3" />
                                Top 3 Connections
                              </div>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 mt-2">
                            {topConnections.map((connection, index) => (
                              <div key={index} className="p-2 bg-muted/30 rounded text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{connection?.topic}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {((connection?.strength || 0) * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                                <div className="text-muted-foreground">{connection?.label}</div>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}
      <AlertDialog open={showAddChannelDialog} onOpenChange={setShowAddChannelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Channel to 10X10?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingVideo?.channelTitle} isn't in your 10X10 spreadsheet yet. Would you like to add it first and then add this video?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingVideo(null); setAddingVideoId(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={addChannelThenReel}>Add Channel and Video</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
