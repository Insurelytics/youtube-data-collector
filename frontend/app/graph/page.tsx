"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Network, HelpCircle, Flame } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import TopicForceGraph from "@/components/TopicForceGraph"

type Topic = {
  id: number
  topic: string
  engagementMultiplier: number
  videoCount: number
  category: string
  group: string
  x?: number
  y?: number
}

type Relationship = { source: number; target: number; strength: number; label: string }

export default function GraphPage() {
  const router = useRouter()
  const [maxNodes, setMaxNodes] = useState(40)
  const [topics, setTopics] = useState<Topic[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const handleGoBack = () => {
    // Check if there's a previous page in history, otherwise go to main dashboard
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGoBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
            </div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Network className="h-8 w-8" />
              Topic Relationship Network
            </h1>
          </div>
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading topic graph...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGoBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
            </div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Network className="h-8 w-8" />
              Topic Relationship Network
            </h1>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-red-600 mb-2">Error: {error}</p>
              <p className="text-sm text-muted-foreground">Failed to load topic data</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header with back button */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGoBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Network className="h-8 w-8" />
                Topic Relationship Network
              </h1>
              <p className="text-muted-foreground">
                Interactive visualization of topic relationships and engagement patterns
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="maxNodes" className="text-sm font-medium">Max Topics:</Label>
                <Select value={maxNodes.toString()} onValueChange={(value) => setMaxNodes(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="40">40</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Guide
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="font-medium">How to use the Topic Graph</h4>
                    <p className="text-sm text-muted-foreground">
                      <strong>Node Size:</strong> Larger circles represent topics with more videos. 
                      Color intensity shows engagement multiplier (green = high performance, red = low performance).
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Connections:</strong> Curved lines show how often topics appear together in the same videos. 
                      Thicker, more opaque lines indicate stronger co-occurrence relationships.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Interaction:</strong> Use mouse wheel to zoom, drag to pan the graph. 
                      Click any topic to see related videos and connections.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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

        {/* Graph container */}
        {topics.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <TopicForceGraph
                topics={topics}
                relationships={relationships}
                selectedTopic={selectedTopic}
                onTopicSelect={setSelectedTopic}
              />
            </div>

            {/* Sidebar with topic details and controls */}
            <div className="space-y-4">
              {selectedTopic ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Flame className="h-5 w-5" />
                      Topic Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const topic = topics.find((t) => t.id === selectedTopic)
                      if (!topic) return null

                      const connections = relationships.filter(
                        (rel) => rel.source === topic.id || rel.target === topic.id,
                      )

                      return (
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg">{topic.topic}</h3>
                            <p className="text-sm text-muted-foreground">{topic.category}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Multiplier</p>
                              <p className="font-semibold">{topic.engagementMultiplier.toFixed(2)}x</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Videos</p>
                              <p className="font-semibold">{topic.videoCount}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Connected Topics</p>
                            <div className="space-y-1">
                              {connections
                                .sort((a, b) => b.strength - a.strength)
                                .slice(0, 5)
                                .map((conn, index) => {
                                  const connectedId = conn.source === topic.id ? conn.target : conn.source
                                  const connectedTopic = topics.find((t) => t.id === connectedId)
                                  if (!connectedTopic) return null

                                  return (
                                    <div key={index} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1">
                                        <span>{connectedTopic.topic}</span>
                                      </div>
                                      <span className="text-muted-foreground">{(conn.strength * 100).toFixed(0)}%</span>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Network className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Click a Topic</h3>
                    <p className="text-muted-foreground text-center text-sm">
                      Click on any topic node to see detailed information and connections
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5" />
                    Performance Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-2">
                    <p>
                      <span className="font-medium text-green-600">Green topics</span> have high engagement multipliers (1.8x+)
                    </p>
                    <p>
                      <span className="font-medium text-red-600">Red topics</span> have low engagement multipliers (&lt;0.8x)
                    </p>
                    <p>
                      <span className="font-medium">Connected topics</span> often appear together in videos
                    </p>
                    <p className="text-muted-foreground">
                      Click topics to see their top-performing videos and explore content opportunities.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
