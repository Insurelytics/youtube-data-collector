"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Users, Eye, MessageCircle, Heart, TrendingUp, Calendar, Play, ExternalLink } from 'lucide-react'
import Link from "next/link"
import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function thumbUrlFrom(thumbnails: any): string {
  try {
    const t = typeof thumbnails === 'string' ? JSON.parse(thumbnails) : thumbnails
    return t?.medium?.url || t?.default?.url || t?.high?.url || ""
  } catch {
    return ""
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

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/channels/${id}/dashboard`)
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
      const res = await fetch(`/api/videos/engagement?channelId=${encodeURIComponent(id)}`)
      const d = await res.json()
      setRecent(Array.isArray(d?.rows) ? d.rows : [])
    })()

    return () => { mounted = false }
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-background"><div className="container mx-auto p-6">Loading…</div></div>
  )

  if (!channel) return (
    <div className="min-h-screen bg-background"><div className="container mx-auto p-6">Channel not found</div></div>
  )

  return (
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
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={channel.thumbnailUrl || "/placeholder.svg"} alt={channel.title} />
                  <AvatarFallback className="text-2xl">{channel.title.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{channel.title}</h1>
                  <p className="text-muted-foreground mb-4">{channel.handle}</p>
                  <p className="text-sm text-muted-foreground mb-4"></p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{formatNumber(channel.subscriberCount || 0)}</span>
                      <span className="text-sm text-muted-foreground">subscribers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{formatNumber(channel.videoCount || 0)}</span>
                      <span className="text-sm text-muted-foreground">videos</span>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="viral">Viral Videos</TabsTrigger>
            <TabsTrigger value="recent">Recent (120d)</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Top Performing Videos */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Videos</CardTitle>
                <CardDescription>Videos with highest engagement scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {top.views.map((video, index) => (
                    <div key={video.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                        {index + 1}
                      </div>
                      <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={thumbUrlFrom(video.thumbnails) || "/placeholder.svg"}
                          alt={video.title}
                          className="w-24 h-14 object-cover rounded"
                        />
                      </a>
                      <div className="flex-1">
                        <h3 className="font-semibold line-clamp-2">
                          <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {video.title}
                          </a>
                        </h3>
                        <p className="text-sm text-muted-foreground">{formatDate(video.publishedAt)}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {formatNumber(video.viewCount || 0)}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {formatNumber(video.commentCount || 0)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {formatNumber(video.likeCount || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="viral" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Viral Videos</CardTitle>
                <CardDescription>Videos with 5x+ more views than subscriber count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {special.map((video, index) => (
                    <div key={video.id} className="flex items-center gap-4 p-4 border rounded-lg bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
                      <div className="flex items-center justify-center w-8 h-8 bg-orange-500 text-white rounded-full text-sm font-bold">
                        🔥
                      </div>
                      <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={thumbUrlFrom(video.thumbnails) || "/placeholder.svg"}
                          alt={video.title}
                          className="w-24 h-14 object-cover rounded"
                        />
                      </a>
                      <div className="flex-1">
                        <h3 className="font-semibold line-clamp-2">
                          <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {video.title}
                          </a>
                        </h3>
                        <p className="text-sm text-muted-foreground">{formatDate(video.publishedAt)}</p>
                        <Badge variant="destructive" className="mt-1">
                          5x+ viral multiplier
                        </Badge>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {formatNumber(video.viewCount || 0)}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {formatNumber(video.commentCount || 0)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {formatNumber(video.likeCount || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Videos (Past 120 Days)</CardTitle>
                <CardDescription>All videos from the last 4 months, ordered by engagement</CardDescription>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((video) => (
                      <TableRow key={video.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
                              <img 
                                src={thumbUrlFrom(video.thumbnails) || "/placeholder.svg"}
                                alt={video.title}
                                className="w-16 h-9 object-cover rounded"
                              />
                            </a>
                            <div>
                              <p className="font-medium line-clamp-2 max-w-xs">
                                <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {video.title}
                                </a>
                              </p>
                              <p className="text-sm text-muted-foreground">{video.durationSeconds ? `${Math.round(video.durationSeconds/60)}m` : ''}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(video.publishedAt)}</TableCell>
                        <TableCell>{formatNumber(video.viewCount || 0)}</TableCell>
                        <TableCell>{formatNumber(video.commentCount || 0)}</TableCell>
                        <TableCell>{formatNumber(video.likeCount || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
