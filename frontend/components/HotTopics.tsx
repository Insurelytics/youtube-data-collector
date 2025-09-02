"use client"

import { useState, useEffect } from "react"
import { Network, Grid3X3, Flame, ChevronDown, Eye, MessageCircle, Heart, LinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Enhanced mock data with cross-category connections and video details
const initialTopicsData = [
  {
    id: 1,
    topic: "AI",
    engagementMultiplier: 4.2,
    videoCount: 45,
    category: "Technology",
    group: "emerging-tech",
    x: 300,
    y: 200,
    description: "AI content is generating 4x more engagement than average",
    topVideos: [
      { title: "ChatGPT vs Google Bard - Ultimate AI Showdown", views: 2800000, comments: 45000, likes: 180000 },
      { title: "I Built an AI That Plays Games Better Than Humans", views: 2200000, comments: 38000, likes: 165000 },
      { title: "The Future of AI in 2024 - What's Coming Next", views: 1900000, comments: 32000, likes: 140000 },
    ],
  },
  {
    id: 2,
    topic: "Machine Learning",
    engagementMultiplier: 3.1,
    videoCount: 28,
    category: "Technology",
    group: "emerging-tech",
    x: 320,
    y: 180,
    description: "Machine learning tutorials driving strong engagement",
    topVideos: [
      { title: "Machine Learning Explained in 10 Minutes", views: 1500000, comments: 28000, likes: 95000 },
      { title: "Building Your First Neural Network", views: 1200000, comments: 22000, likes: 78000 },
      { title: "ML vs AI - What's the Difference?", views: 980000, comments: 18000, likes: 65000 },
    ],
  },
  {
    id: 3,
    topic: "iPhone 15",
    engagementMultiplier: 3.8,
    videoCount: 23,
    category: "Technology",
    group: "consumer-tech",
    x: 500,
    y: 150,
    description: "Latest iPhone reviews driving massive engagement boost",
    topVideos: [
      { title: "iPhone 15 Pro Max - Complete Review After 3 Months", views: 3200000, comments: 52000, likes: 220000 },
      { title: "iPhone 15 vs iPhone 14 - Worth the Upgrade?", views: 2800000, comments: 48000, likes: 195000 },
      {
        title: "iPhone 15 Camera Test - Professional Photographer Review",
        views: 2100000,
        comments: 35000,
        likes: 150000,
      },
    ],
  },
  {
    id: 4,
    topic: "Gaming Setup",
    engagementMultiplier: 2.4,
    videoCount: 67,
    category: "Gaming",
    group: "gaming-hardware",
    x: 200,
    y: 350,
    description: "Setup videos performing 2.4x better than baseline",
    topVideos: [
      { title: "Ultimate Gaming Setup Tour 2024 - $50K Build", views: 1800000, comments: 42000, likes: 125000 },
      { title: "Budget Gaming Setup Under $1000", views: 1500000, comments: 38000, likes: 98000 },
      { title: "RGB vs Performance - What Matters More?", views: 1200000, comments: 28000, likes: 85000 },
    ],
  },
  {
    id: 5,
    topic: "Streaming",
    engagementMultiplier: 1.2,
    videoCount: 28,
    category: "Gaming",
    group: "gaming-content",
    x: 150,
    y: 380,
    description: "Slight engagement boost with growing interest",
    topVideos: [
      { title: "How to Start Streaming in 2024 - Complete Guide", views: 950000, comments: 18000, likes: 62000 },
      { title: "OBS vs Streamlabs - Which is Better?", views: 780000, comments: 15000, likes: 48000 },
      { title: "My Streaming Setup Revealed", views: 650000, comments: 12000, likes: 38000 },
    ],
  },
  {
    id: 6,
    topic: "Recipe Tutorial",
    engagementMultiplier: 1.8,
    videoCount: 89,
    category: "Cooking",
    group: "cooking-basics",
    x: 600,
    y: 300,
    description: "Solid above-average performance in cooking content",
    topVideos: [
      { title: "Perfect Pasta Every Time - Italian Chef's Secret", views: 1200000, comments: 25000, likes: 78000 },
      { title: "5-Minute Breakfast Ideas That Actually Taste Good", views: 980000, comments: 22000, likes: 65000 },
      { title: "Knife Skills Every Home Cook Needs", views: 850000, comments: 18000, likes: 52000 },
    ],
  },
  {
    id: 7,
    topic: "Budget Tech",
    engagementMultiplier: 1.4,
    videoCount: 34,
    category: "Technology",
    group: "consumer-tech",
    x: 480,
    y: 170,
    description: "Moderate engagement boost, steady performance",
    topVideos: [
      { title: "Best Budget Smartphones 2024 - Top 10 Picks", views: 1400000, comments: 28000, likes: 92000 },
      { title: "Cheap vs Expensive Tech - Blind Test", views: 1100000, comments: 24000, likes: 75000 },
      { title: "Budget Gaming Laptop Under $800", views: 890000, comments: 18000, likes: 58000 },
    ],
  },
  {
    id: 8,
    topic: "Food Photography",
    engagementMultiplier: 2.1,
    videoCount: 22,
    category: "Cooking",
    group: "cooking-content",
    x: 580,
    y: 320,
    description: "Visual cooking content performing well",
    topVideos: [
      { title: "Food Photography Tips That Will Blow Your Mind", views: 750000, comments: 15000, likes: 48000 },
      { title: "iPhone vs DSLR for Food Photos", views: 620000, comments: 12000, likes: 38000 },
      { title: "Lighting Setup for Perfect Food Photos", views: 480000, comments: 9000, likes: 28000 },
    ],
  },
]

// Enhanced relationships with cross-category connections
const relationships = [
  // Within Technology
  { source: 1, target: 2, strength: 0.9, label: "AI/ML overlap" },
  { source: 3, target: 7, strength: 0.6, label: "Apple ecosystem" },

  // Cross-category: Tech + Gaming
  { source: 1, target: 4, strength: 0.4, label: "AI in gaming" },
  { source: 7, target: 4, strength: 0.5, label: "Budget gaming tech" },
  { source: 3, target: 5, strength: 0.3, label: "iPhone streaming" },

  // Cross-category: Tech + Cooking
  { source: 3, target: 8, strength: 0.7, label: "iPhone food photography" },
  { source: 1, target: 6, strength: 0.2, label: "AI recipe generation" },

  // Within Gaming
  { source: 4, target: 5, strength: 0.8, label: "Streaming setups" },

  // Within Cooking
  { source: 6, target: 8, strength: 0.6, label: "Recipe presentation" },

  // Cross-category: Gaming + Cooking
  { source: 5, target: 6, strength: 0.3, label: "Cooking streams" },
]

// Group information
const groups = {
  "emerging-tech": { color: "bg-purple-500", label: "Emerging Tech", centerX: 310, centerY: 190 },
  "consumer-tech": { color: "bg-blue-500", label: "Consumer Tech", centerX: 490, centerY: 160 },
  "gaming-hardware": { color: "bg-green-500", label: "Gaming Hardware", centerX: 200, centerY: 350 },
  "gaming-content": { color: "bg-orange-500", label: "Gaming Content", centerX: 150, centerY: 380 },
  "cooking-basics": { color: "bg-red-500", label: "Cooking Basics", centerX: 600, centerY: 300 },
  "cooking-content": { color: "bg-pink-500", label: "Cooking Content", centerX: 580, centerY: 320 },
}

// Precompute final positions using physics simulation
function precomputePositions() {
  let topics = [...initialTopicsData]
  const maxSteps = 100
  const timeStep = 0.1

  for (let step = 0; step < maxSteps; step++) {
    topics = topics.map((topic) => {
      let fx = 0
      let fy = 0

      // Weak center attraction to prevent drift
      const centerX = 400
      const centerY = 250
      fx += (centerX - topic.x) * 0.01
      fy += (centerY - topic.y) * 0.01

      // General repulsion between all nodes (prevent overlap)
      topics.forEach((other) => {
        if (other.id !== topic.id) {
          const dx = topic.x - other.x
          const dy = topic.y - other.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance > 0 && distance < 80) {
            const repelForce = (80 - distance) * 2.0
            fx += (dx / distance) * repelForce
            fy += (dy / distance) * repelForce
          }
        }
      })

      // PID Spring forces for connected nodes
      relationships.forEach((rel) => {
        if (rel.source === topic.id || rel.target === topic.id) {
          const otherId = rel.source === topic.id ? rel.target : rel.source
          const other = topics.find((t) => t.id === otherId)
          if (other) {
            const dx = other.x - topic.x
            const dy = other.y - topic.y
            const currentDistance = Math.sqrt(dx * dx + dy * dy)

            // Desired distance based on relationship strength
            let desiredDistance
            if (rel.strength > 0.7) {
              desiredDistance = 80
            } else if (rel.strength > 0.4) {
              desiredDistance = 120
            } else {
              desiredDistance = 180
            }

            if (currentDistance > 0) {
              const error = currentDistance - desiredDistance
              const kP = 0.1 * rel.strength
              const proportionalForce = error * kP

              fx += (dx / currentDistance) * proportionalForce
              fy += (dy / currentDistance) * proportionalForce
            }
          }
        }
      })

      // Apply forces with fixed timestep and damping
      const damping = 0.7
      const newX = Math.max(50, Math.min(750, topic.x + fx * timeStep * damping))
      const newY = Math.max(50, Math.min(450, topic.y + fy * timeStep * damping))

      return {
        ...topic,
        x: newX,
        y: newY,
      }
    })
  }

  return topics
}

// Precompute the final positions
const precomputedTopics = precomputePositions()

export default function HotTopics() {
  const [topics] = useState(precomputedTopics)
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null)
  const [viewBox, setViewBox] = useState("0 0 800 500")

  // Calculate zoom and pan to fit all nodes with 5% margin
  useEffect(() => {
    const margin = 0.05 // 5% margin
    const nodeRadius = 30 // Maximum node radius

    // Find bounds of all nodes
    const minX = Math.min(...topics.map((t) => t.x)) - nodeRadius
    const maxX = Math.max(...topics.map((t) => t.x)) + nodeRadius
    const minY = Math.min(...topics.map((t) => t.y)) - nodeRadius
    const maxY = Math.max(...topics.map((t) => t.y)) + nodeRadius

    // Calculate content dimensions
    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    // Add margins
    const marginX = contentWidth * margin
    const marginY = contentHeight * margin

    const viewBoxX = minX - marginX
    const viewBoxY = minY - marginY
    const viewBoxWidth = contentWidth + 2 * marginX
    const viewBoxHeight = contentHeight + 2 * marginY

    setViewBox(`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`)
  }, [topics])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatMultiplier = (multiplier: number) => {
    return `${multiplier.toFixed(1)}x`
  }

  const getMultiplierColor = (multiplier: number) => {
    if (multiplier >= 1.2) return "text-green-600 bg-green-50"
    if (multiplier >= 0.8) return "text-yellow-600 bg-yellow-50"
    return "text-red-600 bg-red-50"
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Technology":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "Gaming":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "Cooking":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getNodeSize = (videoCount: number) => {
    return Math.max(30, Math.min(60, videoCount / 2))
  }

  const getProgressValue = (multiplier: number) => {
    return Math.min((multiplier / 5) * 100, 100)
  }

  const getTopConnections = (topicId: number) => {
    return relationships
      .filter((rel) => rel.source === topicId || rel.target === topicId)
      .map((rel) => {
        const connectedId = rel.source === topicId ? rel.target : rel.source
        const connectedTopic = topics.find((t) => t.id === connectedId)
        return connectedTopic ? { ...connectedTopic, strength: rel.strength, label: rel.label } : null
      })
      .filter(Boolean)
      .sort((a, b) => (b?.strength || 0) - (a?.strength || 0))
      .slice(0, 3)
  }

  const getSVGFillClass = (bgClass: string) => {
    const colorMap: { [key: string]: string } = {
      "bg-purple-500": "fill-purple-500",
      "bg-blue-500": "fill-blue-500",
      "bg-green-500": "fill-green-500",
      "bg-orange-500": "fill-orange-500",
      "bg-red-500": "fill-red-500",
      "bg-pink-500": "fill-pink-500",
    }
    return colorMap[bgClass] || "fill-gray-500"
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Topic Analysis Dashboard</h2>
        <p className="text-muted-foreground">
          Interactive visualization and detailed analysis of topic performance and relationships
        </p>
      </div>

      <Tabs defaultValue="force-graph" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="force-graph" className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Force Graph
          </TabsTrigger>
          <TabsTrigger value="visual-cards" className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Visual Cards
          </TabsTrigger>
        </TabsList>

        {/* Force Graph Tab */}
        <TabsContent value="force-graph" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <Card className="h-[600px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Topic Relationship Network
                  </CardTitle>
                  <CardDescription>
                    Interactive force-directed graph showing topic clusters and cross-category connections
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-full p-0">
                  <div className="relative w-full h-[500px] bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden">
                    <svg width="100%" height="100%" viewBox={viewBox} className="absolute inset-0">
                      {/* Relationship lines with similarity-based styling */}
                      {relationships.map((rel, index) => {
                        const source = topics.find((t) => t.id === rel.source)
                        const target = topics.find((t) => t.id === rel.target)
                        if (!source || !target) return null

                        // Color and style based on similarity strength
                        const isCrossCategory = source.category !== target.category
                        const isHighSimilarity = rel.strength > 0.5

                        let strokeColor = "#94a3b8" // Default gray
                        let strokeOpacity = 0.4

                        if (isHighSimilarity) {
                          strokeColor = isCrossCategory ? "#f59e0b" : "#10b981" // Amber for cross-category, green for same
                          strokeOpacity = 0.8
                        } else {
                          strokeColor = "#ef4444" // Red for low similarity
                          strokeOpacity = 0.3
                        }

                        const strokeWidth = 1 + rel.strength * 2

                        return (
                          <line
                            key={index}
                            x1={source.x}
                            y1={source.y}
                            x2={target.x}
                            y2={target.y}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            strokeOpacity={strokeOpacity}
                            strokeDasharray={!isHighSimilarity ? "2,4" : "none"}
                          />
                        )
                      })}

                      {/* Topic nodes as SVG circles */}
                      {topics.map((topic) => {
                        const size = getNodeSize(topic.videoCount)
                        const radius = size / 2

                        return (
                          <g key={topic.id}>
                            <circle
                              cx={topic.x}
                              cy={topic.y}
                              r={radius}
                              className={`cursor-pointer ${getSVGFillClass(groups[topic.group as keyof typeof groups].color)}`}
                              style={{
                                filter:
                                  selectedTopic === topic.id
                                    ? "drop-shadow(0 0 8px rgba(0,0,0,0.3))"
                                    : "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                              }}
                              onClick={() => setSelectedTopic(selectedTopic === topic.id ? null : topic.id)}
                            />
                            <text
                              x={topic.x}
                              y={topic.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="fill-gray-800 font-bold pointer-events-none select-none"
                              style={{
                                fontSize: `${Math.max(8, size / 6)}px`,
                              }}
                            >
                              {topic.topic}
                            </text>
                          </g>
                        )
                      })}
                    </svg>

                    {/* Updated Legend */}
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 text-xs">
                      <div className="font-semibold mb-2">Connections</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-0.5 bg-green-500"></div>
                          <span>High Similarity</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-0.5 bg-amber-500"></div>
                          <span>Cross-Category</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-0.5 bg-red-400 opacity-60" style={{ borderTop: "2px dashed" }}></div>
                          <span>Low Similarity</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

                      const group = groups[topic.group as keyof typeof groups]
                      const connections = relationships.filter(
                        (rel) => rel.source === topic.id || rel.target === topic.id,
                      )

                      return (
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg">{topic.topic}</h3>
                            <Badge className={group.color}>{group.label}</Badge>
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
                            <p className="text-sm font-medium mb-2">Connected Topics</p>
                            <div className="space-y-1">
                              {connections.map((conn, index) => {
                                const connectedId = conn.source === topic.id ? conn.target : conn.source
                                const connectedTopic = topics.find((t) => t.id === connectedId)
                                if (!connectedTopic) return null

                                const isCrossCategory = topic.category !== connectedTopic.category

                                return (
                                  <div key={index} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1">
                                      <span>{connectedTopic.topic}</span>
                                      {isCrossCategory && (
                                        <Badge variant="outline" className="text-xs">
                                          Cross
                                        </Badge>
                                      )}
                                    </div>
                                    <Badge variant="outline">{(conn.strength * 100).toFixed(0)}%</Badge>
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
                  <CardTitle>Cross-Category Connections</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {relationships
                    .filter((rel) => {
                      const source = topics.find((t) => t.id === rel.source)
                      const target = topics.find((t) => t.id === rel.target)
                      return source && target && source.category !== target.category
                    })
                    .slice(0, 5)
                    .map((rel, index) => {
                      const source = topics.find((t) => t.id === rel.source)
                      const target = topics.find((t) => t.id === rel.target)
                      return (
                        <div key={index} className="text-xs p-2 bg-amber-50 rounded border border-amber-200">
                          <div className="font-medium">
                            {source?.topic} ↔ {target?.topic}
                          </div>
                          <div className="text-muted-foreground">{rel.label}</div>
                        </div>
                      )
                    })}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Visual Cards Tab */}
        <TabsContent value="visual-cards" className="space-y-6">
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
                        <Badge variant="outline" className={getCategoryColor(topic.category)}>
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
                            className={`font-semibold ${getMultiplierColor(topic.engagementMultiplier).split(" ")[0]}`}
                          >
                            {formatMultiplier(topic.engagementMultiplier)}
                          </span>
                        </div>
                        <Progress value={getProgressValue(topic.engagementMultiplier)} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1">
                          {topic.engagementMultiplier >= 1.2
                            ? "Above Average"
                            : topic.engagementMultiplier >= 0.8
                              ? "Near Average"
                              : "Below Average"}
                        </div>
                      </div>

                      <div className="text-sm">
                        <span className="text-muted-foreground">{topic.videoCount} videos</span>
                      </div>

                      {/* Top Videos Dropdown */}
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-between bg-transparent">
                            <div className="flex items-center gap-2">
                              <Eye className="h-3 w-3" />
                              Top 3 Videos
                            </div>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {topic.topVideos.map((video, index) => (
                            <div key={index} className="p-2 bg-muted/30 rounded text-xs">
                              <div className="font-medium line-clamp-2 mb-1">{video.title}</div>
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Eye className="h-2 w-2" />
                                  {formatNumber(video.views)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <MessageCircle className="h-2 w-2" />
                                  {formatNumber(video.comments)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Heart className="h-2 w-2" />
                                  {formatNumber(video.likes)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>

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
                                {topic.category !== connection?.category && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    Cross-category
                                  </Badge>
                                )}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
