"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ExternalLink, UserPlus, Trash2, Search, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SuggestedChannel {
  id: string
  username: string
  fullName: string | null
  followersCount: number | null
  followsCount: number | null
  postsCount: number | null
  verified: boolean
  isPrivate: boolean
  biography: string | null
  externalUrl: string | null
  profilePicUrl: string | null
  searchTerm: string
  foundAt: string
  platform: string
}

export function SuggestedChannelsPage() {
  const [channels, setChannels] = useState<SuggestedChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minFollowers, setMinFollowers] = useState<number>(1000)
  const [maxFollowers, setMaxFollowers] = useState<number>(1000000)
  const [tempMinFollowers, setTempMinFollowers] = useState<string>('1000')
  const [tempMaxFollowers, setTempMaxFollowers] = useState<string>('1000000')
  const [isMinFocused, setIsMinFocused] = useState<boolean>(false)
  const [isMaxFocused, setIsMaxFocused] = useState<boolean>(false)

  const fetchChannels = async () => {
    try {
      const params = new URLSearchParams({
        minFollowers: String(minFollowers),
        maxFollowers: String(maxFollowers)
      })
      const response = await fetch(`/api/suggested-channels?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch suggested channels')
      const data = await response.json()
      setChannels(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch channels')
    } finally {
      setLoading(false)
    }
  }

  // Load filters from localStorage on mount
  useEffect(() => {
    const savedMin = typeof window !== 'undefined' ? window.localStorage.getItem('suggestedChannels:minFollowers') : null
    const savedMax = typeof window !== 'undefined' ? window.localStorage.getItem('suggestedChannels:maxFollowers') : null
    if (savedMin) {
      const parsed = parseInt(savedMin, 10)
      if (!Number.isNaN(parsed)) setMinFollowers(parsed)
      if (!Number.isNaN(parsed)) setTempMinFollowers(String(parsed))
    }
    if (savedMax) {
      const parsed = parseInt(savedMax, 10)
      if (!Number.isNaN(parsed)) setMaxFollowers(parsed)
      if (!Number.isNaN(parsed)) setTempMaxFollowers(String(parsed))
    }
  }, [])

  const addChannelToTracking = async (channel: SuggestedChannel) => {
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: channel.username,
          platform: channel.platform
        })
      })
      
      if (!response.ok) throw new Error('Failed to add channel to tracking')
      
      // Remove from suggested channels after adding to tracking
      await removeChannel(channel.id)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add channel')
    }
  }

  const removeChannel = async (channelId: string) => {
    try {
      const response = await fetch(`/api/suggested-channels/${channelId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to remove channel')
      setChannels(prev => prev.filter(c => c.id !== channelId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove channel')
    }
  }

  const formatNumber = (num: number | null) => {
    if (num === null) return 'N/A'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCompactInt = (num: number) => {
    if (Number.isNaN(num)) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return String(num)
  }

  const getInstagramUrl = (username: string) => `https://instagram.com/${username}`

  // Persist filters and refetch when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('suggestedChannels:minFollowers', String(minFollowers))
      window.localStorage.setItem('suggestedChannels:maxFollowers', String(maxFollowers))
    }
    setLoading(true)
    fetchChannels()
  }, [minFollowers, maxFollowers])

  // Initial fetch
  useEffect(() => {
    fetchChannels()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading suggested channels...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Suggested Channels</h2>
          <p className="text-muted-foreground">
            Channels found based on your tracked content topics
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground mb-1">Min followers</label>
            <Input
              type="text"
              className="w-36"
              value={isMinFocused ? tempMinFollowers : formatCompactInt(parseInt(tempMinFollowers || '0', 10))}
              onFocus={() => setIsMinFocused(true)}
              onChange={(e) => setTempMinFollowers(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(tempMinFollowers, 10)
                const normalized = Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
                setMinFollowers(normalized)
                setTempMinFollowers(String(normalized))
                setIsMinFocused(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const parsed = parseInt(tempMinFollowers, 10)
                  const normalized = Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
                  setMinFollowers(normalized)
                  setTempMinFollowers(String(normalized))
                  setIsMinFocused(false)
                }
              }}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground mb-1">Max followers</label>
            <Input
              type="text"
              className="w-36"
              value={isMaxFocused ? tempMaxFollowers : formatCompactInt(parseInt(tempMaxFollowers || '0', 10))}
              onFocus={() => setIsMaxFocused(true)}
              onChange={(e) => setTempMaxFollowers(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(tempMaxFollowers, 10)
                const normalized = Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
                setMaxFollowers(normalized)
                setTempMaxFollowers(String(normalized))
                setIsMaxFocused(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const parsed = parseInt(tempMaxFollowers, 10)
                  const normalized = Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
                  setMaxFollowers(normalized)
                  setTempMaxFollowers(String(normalized))
                  setIsMaxFocused(false)
                }
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {channels.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Suggested Channels</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting the follower filters to refine your suggested accounts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <Card key={channel.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage 
                        src={channel.profilePicUrl || undefined} 
                        alt={channel.username}
                      />
                      <AvatarFallback>
                        {channel.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">
                        @{channel.username}
                        {channel.verified && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            ✓
                          </Badge>
                        )}
                      </CardTitle>
                      {channel.fullName && (
                        <p className="text-sm text-muted-foreground truncate">
                          {channel.fullName}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeChannel(channel.id)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="font-semibold">
                      {formatNumber(channel.followersCount)}
                    </div>
                    <div className="text-muted-foreground">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">
                      {formatNumber(channel.followsCount)}
                    </div>
                    <div className="text-muted-foreground">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">
                      {formatNumber(channel.postsCount)}
                    </div>
                    <div className="text-muted-foreground">Posts</div>
                  </div>
                </div>

                {/* Biography */}
                {channel.biography && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {channel.biography}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => addChannelToTracking(channel)}
                    className="flex-1 text-sm"
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add to Tracking
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={getInstagramUrl(channel.username)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
