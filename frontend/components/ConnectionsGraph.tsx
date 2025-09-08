"use client"

import { useState, useEffect } from "react"
import { Network, Flame, HelpCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import TopicForceGraph from "@/components/TopicForceGraph"

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

// Generate group information dynamically based on category and its color
const getGroupInfo = (category: string, categoryColor?: string) => {
  // Convert hex color to Tailwind-like background class
  const getTailwindColor = (hexColor?: string) => {
    if (!hexColor) {
      // Fallback to a default color if no color provided
      return "bg-slate-500"
    }
    
    // For now, use a style attribute instead of trying to match exact Tailwind classes
    return ""
  }
  
  return {
    color: getTailwindColor(categoryColor),
    backgroundColor: categoryColor,
    label: category,
    centerX: 400, // Default center position
    centerY: 250
  }
}

export default function ConnectionsGraph() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null)
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Topic Connections Graph</h2>
            <p className="text-muted-foreground">Loading topic data...</p>
          </div>
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
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Topic Connections Graph</h2>
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Topic Connections Graph</h2>
          <p className="text-muted-foreground">
            Interactive visualization of topic relationships and connections
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
            <Network className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Topic Connections Available</h3>
            <p className="text-muted-foreground text-center">
              There are not enough videos in the database to display topic connections. Add more channels and let them sync to see topic relationships.
            </p>
          </CardContent>
        </Card>
      )}

      {topics.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Network className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-semibold">Topic Connections Graph</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" align="start">
                  <div className="space-y-3 text-sm">
                    <h4 className="font-semibold">Understanding the Graph</h4>
                    <p>
                      <strong>Node Size:</strong> Larger circles represent topics with more videos (higher video count). 
                      Size is based on how many videos contain that topic.
                    </p>
                    <p>
                      <strong>Node Color:</strong> Colors show engagement performance - green for excellent (1.8x+), 
                      yellow for good/average (1.0-1.5x), orange/red for below average (&lt;1.0x).
                    </p>
                    <p>
                      <strong>Connections:</strong> Curved lines show how often topics appear together in the same videos. 
                      Thicker, more opaque lines indicate stronger co-occurrence relationships.
                    </p>
                    <p>
                      <strong>Interaction:</strong> Use mouse wheel to zoom, drag to pan the graph. 
                      Click any topic to see detailed information.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <TopicForceGraph
                topics={topics}
                relationships={relationships}
                selectedTopic={selectedTopic}
                onTopicSelect={setSelectedTopic}
              />
            </div>

            {/* Sidebar for Force Graph */}
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

                      const group = getGroupInfo(topic.category, topic.categoryColor)
                      const connections = relationships.filter(
                        (rel) => rel.source === topic.id || rel.target === topic.id,
                      )

                      return (
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              {topic.isCategory && <span>👑</span>}
                              {topic.topic}
                            </h3>
                            <div className="flex gap-2">
                              <Badge 
                                className={topic.isCategory ? "bg-purple-500" : ""}
                                style={!topic.isCategory && group.backgroundColor ? { backgroundColor: group.backgroundColor, color: 'white' } : {}}
                              >
                                {topic.isCategory ? "Category" : group.label}
                              </Badge>
                              {topic.isCategory && topic.incomingCategoryConnections && topic.incomingCategoryConnections.length > 0 && (
                                <Badge variant="outline">
                                  {topic.incomingCategoryConnections.length} sub-topics
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Multiplier</p>
                              <p className="font-semibold">{formatMultiplier(topic.engagementMultiplier)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Videos</p>
                              <p className="font-semibold">{topic.videoCount}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">
                              Connected Topics
                            </p>
                            <div className="space-y-1">
                              {(topic.outgoingConnections || [])
                                .sort((a, b) => b.strength - a.strength)
                                .map((conn, index) => (
                                  <div key={index} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1">
                                      <span>{conn.targetTopic}</span>
                                    </div>
                                    <Badge variant="outline">{(conn.strength * 100).toFixed(0)}%</Badge>
                                  </div>
                                ))}
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
                  <CardTitle>Top Trending Topics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topics
                    .sort((a, b) => b.engagementMultiplier - a.engagementMultiplier)
                    .slice(0, 5)
                    .map((topic, index) => (
                      <div key={index} className="text-xs p-2 bg-green-50 rounded border border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{topic.topic}</div>
                          <Badge variant="outline" className="text-green-700">
                            {formatMultiplier(topic.engagementMultiplier)}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">{topic.description}</div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
