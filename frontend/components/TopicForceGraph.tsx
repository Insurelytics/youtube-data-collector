"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as d3 from "d3"
import { Network, Eye, MessageCircle, Heart, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

type Video = {
  id: string
  title: string
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  thumbnails: string | null
  platform: string
  videoUrl: string | null
  channelTitle?: string
  localImageUrl?: string | null
  shortCode?: string | null
}

type Props = {
  topics: Topic[]
  relationships: Relationship[]
  selectedTopic: number | null
  onTopicSelect: (id: number | null) => void
}

const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 1.8,
  VERY_GOOD: 1.5,
  GOOD: 1.2,
  ABOVE_AVG: 1.05,
  AVERAGE: 0.95,
}

const ENABLE_MOVEMENT = true // Set to true to enable force simulation, false to see static preprocessing
const FORCE_STRENGTH = 0.5 // Controls how weak the forces are (0.1 = very weak, 1.0 = normal strength)
const NUM_PHYSICS_CONNECTIONS = 3 // Maximum number of connections per node for physics simulation

const getNodeRadius = (videoCount: number) =>
  Math.max(15, Math.min(30, videoCount / 2))
const getNodeSize = (vc: number) => Math.max(30, Math.min(60, vc / 2))

const getMultiplierColor = (m: number) => {
  if (m >= PERFORMANCE_THRESHOLDS.EXCELLENT) return "fill-emerald-500"
  if (m >= PERFORMANCE_THRESHOLDS.VERY_GOOD) return "fill-green-500"
  if (m >= PERFORMANCE_THRESHOLDS.GOOD) return "fill-lime-500"
  if (m >= PERFORMANCE_THRESHOLDS.ABOVE_AVG) return "fill-yellow-400"
  if (m >= PERFORMANCE_THRESHOLDS.AVERAGE) return "fill-yellow-500"
  if (m >= 0.8) return "fill-orange-500"
  return "fill-red-500"
}

// ------------------------------
// Hash-based deterministic positioning
// ------------------------------
function hashStringToSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

function getRandomPosition(topic: string, width = 3000, height = 2000) {
  const seed = hashStringToSeed(topic)
  
  // Create a proper PRNG with independent x and y values
  function lcg(seed: number) {
    const a = 1664525
    const c = 1013904223
    const m = Math.pow(2, 32)
    return ((a * seed + c) % m) / m
  }
  
  // Use different seeds for x and y to ensure independence
  const x = lcg(seed)
  const y = lcg(seed * 9973) // Use a different prime multiplier for y
  
  return {
    x: x * width,
    y: y * height
  }
}

// ------------------------------
// Component
// ------------------------------
export default function TopicForceGraph({
  topics: inputTopics,
  relationships,
  selectedTopic,
  onTopicSelect,
}: Props) {
  const [nodes, setNodes] = useState<Topic[]>([])
  const [transform, setTransform] = useState(d3.zoomIdentity)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<d3.Simulation<any, undefined> | null>(null)
  const [selectedTopicVideos, setSelectedTopicVideos] = useState<Video[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)

  const links = useMemo(() => relationships.map(r => ({ ...r })), [relationships])
  
  // Filtered relationships for both physics and visual display
  const [filteredRelationships, setFilteredRelationships] = useState<Relationship[]>([])
  
  // Update filtered relationships when relationships change
  useEffect(() => {
    const filtered = filterConnectionsForPhysics(relationships, NUM_PHYSICS_CONNECTIONS)
    setFilteredRelationships(filtered)
  }, [relationships])

  // Fetch videos for selected topic
  useEffect(() => {
    if (!selectedTopic) {
      setSelectedTopicVideos([])
      return
    }

    const fetchTopicVideos = async () => {
      setLoadingVideos(true)
      try {
        const selectedTopicData = inputTopics.find(t => t.id === selectedTopic)
        if (!selectedTopicData) return

        const response = await fetch(`/api/topics/${encodeURIComponent(selectedTopicData.topic)}/videos?pageSize=10`)
        if (!response.ok) throw new Error('Failed to fetch videos')
        
        const data = await response.json()
        setSelectedTopicVideos(data.videos || [])
      } catch (error) {
        console.error('Error fetching topic videos:', error)
        setSelectedTopicVideos([])
      } finally {
        setLoadingVideos(false)
      }
    }

    fetchTopicVideos()
  }, [selectedTopic, inputTopics])

  // Preprocessing: move closely connected topics closer together
  const preprocessConnectedPairs = (nodes: Topic[], relationships: Relationship[], strengthThreshold = 0.8, iterations = 1) => {
    let processedNodes = [...nodes]
    
    // Filter relationships above the threshold
    const strongConnections = relationships.filter(rel => rel.strength >= strengthThreshold)
    
    console.log(`Processing ${strongConnections.length} connections above ${(strengthThreshold * 100)}% threshold for ${iterations} iterations`)
    
    for (let iter = 0; iter < iterations; iter++) {
      console.log(`--- Iteration ${iter + 1} ---`)
      const usedPairsThisIteration = new Set<string>()
      
      for (const rel of strongConnections) {
        const pairKey1 = `${rel.source}-${rel.target}`
        const pairKey2 = `${rel.target}-${rel.source}`
        
        // Skip if this pair has already been processed in THIS iteration
        if (usedPairsThisIteration.has(pairKey1) || usedPairsThisIteration.has(pairKey2)) continue
        
        // Mark this pair as used for this iteration only
        usedPairsThisIteration.add(pairKey1)
        usedPairsThisIteration.add(pairKey2)
        
        // Find the nodes and average their positions
        const sourceNode = processedNodes.find(n => n.id === rel.source)
        const targetNode = processedNodes.find(n => n.id === rel.target)
        
        if (sourceNode && targetNode && sourceNode.x !== undefined && sourceNode.y !== undefined && 
            targetNode.x !== undefined && targetNode.y !== undefined) {
          const avgX = (sourceNode.x + targetNode.x) / 2
          const avgY = (sourceNode.y + targetNode.y) / 2
          
          sourceNode.x = avgX
          sourceNode.y = avgY
          targetNode.x = avgX
          targetNode.y = avgY
          
          console.log(`Moved ${sourceNode.topic} and ${targetNode.topic} to (${avgX.toFixed(2)}, ${avgY.toFixed(2)}) - strength: ${rel.strength.toFixed(3)}`)
        }
      }
    }
    
    return processedNodes
  }

  // Separate overlapping nodes, prioritizing weaker connections to move first
  const separateOverlappingNodes = (nodes: Topic[], relationships: Relationship[], maxIterations = 50) => {
    const processedNodes = [...nodes]
    
    // Calculate total connection strength for each node
    const nodeStrengths = new Map<number, number>()
    relationships.forEach(rel => {
      nodeStrengths.set(rel.source, (nodeStrengths.get(rel.source) || 0) + rel.strength)
      nodeStrengths.set(rel.target, (nodeStrengths.get(rel.target) || 0) + rel.strength)
    })
    
    // Sort nodes by connection strength (weakest first)
    const nodesByStrength = processedNodes.slice().sort((a, b) => {
      const strengthA = nodeStrengths.get(a.id) || 0
      const strengthB = nodeStrengths.get(b.id) || 0
      return strengthA - strengthB
    })
    
    console.log(`Separating overlapping nodes - weakest to strongest connections`)
    
    for (let iter = 0; iter < maxIterations; iter++) {
      let movedAny = false
      
      for (const node of nodesByStrength) {
        if (!node.x || !node.y) continue
        
        const nodeRadius = getNodeRadius(node.videoCount)
        
        // Check for overlaps with other nodes
        for (const otherNode of processedNodes) {
          if (node.id === otherNode.id || !otherNode.x || !otherNode.y) continue
          
          const otherRadius = getNodeRadius(otherNode.videoCount)
          const minDistance = nodeRadius + otherRadius + 10 // 10px padding
          
          const dx = node.x - otherNode.x
          const dy = node.y - otherNode.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance < minDistance) {
            // Move the current node away from the overlapping node
            const angle = Math.atan2(dy, dx)
            const targetDistance = minDistance + 5 // Extra padding
            
            node.x = otherNode.x + Math.cos(angle) * targetDistance
            node.y = otherNode.y + Math.sin(angle) * targetDistance
            
            movedAny = true
            
            const nodeStrength = nodeStrengths.get(node.id) || 0
            console.log(`Iter ${iter + 1}: Moved ${node.topic} (strength: ${nodeStrength.toFixed(3)}) away from ${otherNode.topic}`)
            break // Only move away from first overlapping node per iteration
          }
        }
      }
      
      if (!movedAny) {
        console.log(`No overlaps found after ${iter + 1} iterations`)
        break
      }
    }
    
    return processedNodes
  }

  // Filter connections to keep only the strongest ones per node for physics
  const filterConnectionsForPhysics = (relationships: Relationship[], maxConnectionsPerNode: number) => {
    // Group connections by node
    const nodeConnections = new Map<number, Relationship[]>()
    
    relationships.forEach(rel => {
      if (!nodeConnections.has(rel.source)) nodeConnections.set(rel.source, [])
      if (!nodeConnections.has(rel.target)) nodeConnections.set(rel.target, [])
      
      nodeConnections.get(rel.source)!.push(rel)
      nodeConnections.get(rel.target)!.push(rel)
    })
    
    // For each node, keep only the strongest connections
    const filteredConnections = new Set<string>()
    
    nodeConnections.forEach((connections, nodeId) => {
      // Sort by strength (strongest first) and take top N
      const sortedConnections = connections
        .sort((a, b) => b.strength - a.strength)
        .slice(0, maxConnectionsPerNode)
      
      sortedConnections.forEach(rel => {
        // Create a consistent key for the relationship
        const key = rel.source < rel.target ? `${rel.source}-${rel.target}` : `${rel.target}-${rel.source}`
        filteredConnections.add(key)
      })
    })
    
    // Filter original relationships to keep only the selected ones
    const result = relationships.filter(rel => {
      const key = rel.source < rel.target ? `${rel.source}-${rel.target}` : `${rel.target}-${rel.source}`
      return filteredConnections.has(key)
    })
    
    console.log(`Filtered connections for physics: ${relationships.length} → ${result.length}`)
    return result
  }

  // Assign hash-based deterministic positions
  const seededNodes = useMemo(() => {
    const nodes = inputTopics.map(t => {
      const pos = getRandomPosition(t.topic)
      return {
        ...t,
        x: pos.x,
        y: pos.y,
      }
    })

    // Apply preprocessing to move connected pairs closer
    const preprocessedNodes = preprocessConnectedPairs(nodes, relationships, 0.5, 3)

    // Separate any overlapping nodes
    const separatedNodes = separateOverlappingNodes(preprocessedNodes, relationships, 50)

    console.log("Final topic locations after preprocessing and separation:")
    separatedNodes.forEach(n =>
      console.log(`${n.topic}: x=${n.x?.toFixed(2)}, y=${n.y?.toFixed(2)}`)
    )
    return separatedNodes
  }, [inputTopics, relationships])

  useEffect(() => {
    if (!seededNodes.length) return
    simRef.current?.stop()

    if (!ENABLE_MOVEMENT) {
      // Static mode: Just set the nodes without any simulation
      setNodes([...seededNodes])
      return
    }
    
    const nodeById = new Map(seededNodes.map(n => [n.id, n]))
    const d3Links = filteredRelationships
      .filter(l => nodeById.has(l.source) && nodeById.has(l.target))
      .map(l => ({
        source: nodeById.get(l.source)!,
        target: nodeById.get(l.target)!,
        strength: l.strength,
      }))

    let tickCount = 0
    const simulation = d3
      .forceSimulation(seededNodes as any)
      .randomSource(d3.randomLcg(1337))
      .force("charge", d3.forceManyBody()
        .strength(-30 * FORCE_STRENGTH)
        .theta(0.9) // Increase theta for better performance (less accuracy, more speed)
      )
      .force(
        "link",
        d3
          .forceLink(d3Links as any)
          .id((d: any) => d.id)
          .distance(100)
          .strength(0.1 * FORCE_STRENGTH) // Simplified strength calculation
          .iterations(1) // Reduce iterations for better performance
      )
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d: any) => getNodeRadius(d.videoCount) + 5)
          .strength(0.5 * FORCE_STRENGTH)
          .iterations(1) // Reduce collision iterations
      )
      .alpha(0.1) // Lower initial alpha for faster settling
      .alphaDecay(1 - Math.pow(0.001, 1 / 150)) // Faster decay
      .velocityDecay(0.6) // Higher velocity decay for stability
      .on("tick", () => {
        tickCount++
        if (tickCount % 10 === 0) { // Update less frequently
          setNodes([...seededNodes])
        }
      })
      .on("end", () => setNodes([...seededNodes]))

    simRef.current = simulation
    return () => void simulation.stop()
  }, [seededNodes, links])

  // Setup zoom behavior
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .filter((event) => {
        // Allow wheel events for zooming
        if (event.type === 'wheel') return true
        // For pan events (mousedown, mousemove), check if we're over a topic
        const target = event.target as Element
        return !target.closest('.cursor-pointer')
      })
      .on('zoom', (event) => {
        setTransform(event.transform)
      })

    svg.call(zoom)

    // Set initial zoom to fit content when nodes are loaded
    if (nodes.length > 0) {
      const pad = 40
      const xs = nodes.map(n => n.x ?? 0)
      const ys = nodes.map(n => n.y ?? 0)
      const minX = Math.min(...xs) - pad
      const maxX = Math.max(...xs) + pad
      const minY = Math.min(...ys) - pad
      const maxY = Math.max(...ys) + pad
      
      const width = 800
      const height = 500
      const dx = maxX - minX
      const dy = maxY - minY
      const x = (minX + maxX) / 2
      const y = (minY + maxY) / 2
      const scale = Math.min(width / dx, height / dy) * 0.9
      
      const initialTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(scale)
        .translate(-x, -y)
      
      svg.transition()
        .duration(750)
        .call(zoom.transform, initialTransform)
    }

    return () => {
      svg.on('.zoom', null)
    }
  }, [nodes])

  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  
  // Get connected node IDs for the selected topic
  const connectedNodeIds = useMemo(() => {
    if (!selectedTopic) return new Set<number>()
    
    const connected = new Set<number>()
    filteredRelationships.forEach(rel => {
      if (rel.source === selectedTopic) connected.add(rel.target)
      if (rel.target === selectedTopic) connected.add(rel.source)
    })
    return connected
  }, [selectedTopic, filteredRelationships])

  const pathFor = (a: Topic, b: Topic) => {
    const mx = ((a.x ?? 0) + (b.x ?? 0)) / 2
    const my = ((a.y ?? 0) + (b.y ?? 0)) / 2
    const dx = (b.x ?? 0) - (a.x ?? 0)
    const dy = (b.y ?? 0) - (a.y ?? 0)
    const k = 0.12
    const nx = -dy * k,
      ny = dx * k
    return `M ${a.x} ${a.y} Q ${mx + nx} ${my + ny} ${b.x} ${b.y}`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getVideoUrl = (video: Video) => {
    if (video.videoUrl) return video.videoUrl
    if (video.platform === 'youtube') return `https://www.youtube.com/watch?v=${video.id}`
    if (video.platform === 'instagram') {
      // For Instagram, use shortCode if available, otherwise use id
      const identifier = video.id
      return `https://www.instagram.com/p/${identifier}/`
    }
    return null
  }

  const getImageUrl = (video: Video) => {
    // For Instagram reels, prioritize locally downloaded image to avoid CORS issues
    if (video.platform === 'instagram' && video.localImageUrl) {
      // Extract filename from localImageUrl (could be full path or just filename)
      const filename = video.localImageUrl.includes('/') 
        ? video.localImageUrl.split('/').pop() 
        : video.localImageUrl
      return `/api/images/${filename}`
    }
    
    // For YouTube videos, use thumbnails with the correct structure
    if (video.thumbnails) {
      try {
        const t = typeof video.thumbnails === 'string' ? JSON.parse(video.thumbnails) : video.thumbnails
        const thumbnailUrl = t?.medium?.url || t?.default?.url || t?.high?.url
        if (thumbnailUrl) return thumbnailUrl
      } catch {
        // If parsing fails, fallback to placeholder
      }
    }
    
    return '/placeholder-video.jpg'
  }

  const handleVideoClick = (video: Video) => {
    const url = getVideoUrl(video)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="h-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Topic Relationship Network
          </CardTitle>
          <CardDescription>
            Use mouse wheel or trackpad to zoom, drag to pan
          </CardDescription>
        </CardHeader>
        <CardContent className="h-full p-0">
          <div className="relative w-full h-[500px] bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden">
            <svg 
              ref={svgRef}
              width="100%" 
              height="100%" 
              viewBox="0 0 800 500" 
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
            >
              <g transform={transform.toString()}>
                {/* Links */}
                {filteredRelationships.map((rel, i) => {
                  const a = byId.get(rel.source),
                    b = byId.get(rel.target)
                  if (!a || !b) return null
                  
                  const strength = rel.strength || 0
                  const strokeWidth = Math.max(0.5, Math.min(3, 0.5 + strength * 4))
                  const opacity = Math.max(0.2, Math.min(0.8, 0.3 + strength * 0.7))
                  
                  // Check if this connection involves the selected topic
                  const isConnectedToSelected = selectedTopic && (rel.source === selectedTopic || rel.target === selectedTopic)
                  
                  return (
                    <path
                      key={i}
                      d={pathFor(a, b)}
                      stroke={isConnectedToSelected ? "#3b82f6" : "#64748b"}
                      strokeWidth={isConnectedToSelected ? strokeWidth + 2 : strokeWidth}
                      strokeOpacity={isConnectedToSelected ? 1 : opacity}
                      fill="none"
                      style={{
                        filter: isConnectedToSelected 
                          ? "drop-shadow(0 0 4px rgba(59, 130, 246, 0.6))" 
                          : "none"
                      }}
                    />
                  )
                })}

                {/* Nodes */}
                {nodes.map(n => {
                  const size = getNodeSize(n.videoCount)
                  const r = size / 2
                  const selected = selectedTopic === n.id
                  const connected = connectedNodeIds.has(n.id)
                  
                  let filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                  if (selected) {
                    filter = "drop-shadow(0 0 10px rgba(255, 215, 0, 0.6)) drop-shadow(0 0 4px rgba(255, 165, 0, 0.8))" // Moderate golden glow for selected
                  } else if (connected) {
                    filter = "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5)) drop-shadow(0 0 3px rgba(59, 130, 246, 0.7))" // Moderate blue glow for connected
                  }
                  
                  return (
                    <g
                      key={n.id}
                      className="cursor-pointer"
                      onClick={() => onTopicSelect(selected ? null : n.id)}
                    >
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={r}
                        className={`${getMultiplierColor(n.engagementMultiplier)}`}
                        style={{ filter }}
                      />
                      <text
                        x={n.x}
                        y={n.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-800 font-bold pointer-events-none select-none"
                        style={{ fontSize: `${Math.max(8, size / 6)}px` }}
                      >
                        {n.topic}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Selected Topic Videos Section */}
      {selectedTopic && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Top Videos for "{inputTopics.find(t => t.id === selectedTopic)?.topic}"
            </CardTitle>
            <CardDescription>
              Click on any video to open it in a new tab
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingVideos ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Loading videos...</span>
              </div>
            ) : selectedTopicVideos.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {selectedTopicVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => handleVideoClick(video)}
                    className="group p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer hover:border-blue-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`bg-gray-100 rounded overflow-hidden flex-shrink-0 ${
                        video.platform === 'instagram' ? 'w-14 h-20' : 'w-20 h-14'
                      }`}>
                        <img 
                          src={getImageUrl(video)} 
                          alt={video.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-video.jpg'
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2 group-hover:text-blue-600">
                          {video.title}
                        </h4>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {formatNumber(video.viewCount || 0)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {formatNumber(video.likeCount || 0)}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {formatNumber(video.commentCount || 0)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">
                            {video.platform === 'youtube' ? 'YouTube' : 'Instagram'}
                          </Badge>
                          <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-blue-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No videos found for this topic</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
