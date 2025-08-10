"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, TrendingUp, Users, Eye, MessageCircle, Heart, ExternalLink, RefreshCcw } from 'lucide-react'
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type UiChannel = {
  id: string
  name: string
  handle: string
  subscribers: number
  avatar: string
  totalVideos: number
  totalViews: number
  avgViews: number
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toFixed(0).toString()
}

function extractHandle(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("@")) return trimmed
  try {
    const url = new URL(trimmed)
    const seg = url.pathname.split("/").filter(Boolean).pop() || ""
    return seg.startsWith("@") ? seg : ""
  } catch {
    return ""
  }
}

export default function HomePage() {
  const [channels, setChannels] = useState<UiChannel[]>([])
  const [newChannelUrl, setNewChannelUrl] = useState("")
  const [loading, setLoading] = useState(false)

  async function loadChannels() {
    const res = await fetch("/api/channels")
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
    }))
    setChannels(mapped)
  }

  useEffect(() => {
    loadChannels()
  }, [])

  async function addChannel() {
    const handle = extractHandle(newChannelUrl)
    if (!handle) return
    setLoading(true)
    try {
      const res = await fetch("/api/channels", {
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
    setLoading(true)
    try {
      await fetch(`/api/channels/${id}`, { method: "DELETE" })
      await loadChannels()
    } finally {
      setLoading(false)
    }
  }

  async function resyncChannel(handle: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ handle, sinceDays: String(36500) })
      const res = await fetch(`/api/sync?${params.toString()}`)
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">YouTube Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track and analyze your favorite YouTube channels</p>
        </div>

        {/* Add Channel Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Channel
            </CardTitle>
            <CardDescription>
              Enter a YouTube channel URL or handle to start tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="https://youtube.com/@channelname or @channelname"
                value={newChannelUrl}
                onChange={(e) => setNewChannelUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={addChannel} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Channel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tracked Channels */}
        <div className="mb-6">
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
                      onClick={() => channel.handle && resyncChannel(channel.handle)}
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeChannel(channel.id)}
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
                    <Badge variant="secondary" className="text-xs">
                      {formatNumber(channel.avgViews)} avg
                    </Badge>
                  </div>
                </div>
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
      </div>
    </div>
  )
}
