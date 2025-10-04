"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as d3 from "d3"
import { Network, Eye, MessageCircle, Heart, ExternalLink, User, ZoomIn, ZoomOut, RotateCcw, Loader2, File } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { VideoSheetButton } from "@/components/VideoSheetButton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Topic = {
  id: number
  topic: string
  engagementMultiplier: number
  videoCount: number
  category: string
  categoryColor?: string
  group: string
  x?: number
  y?: number
  isCategory?: boolean
  incomingCategoryConnections?: string[]
  outgoingConnections?: Array<{
    targetTopic: string
    strength: number
  }>
}

type Relationship = { 
  source: number; 
  target: number; 
  strength: number; 
  label: string;
  forwardStrength?: number;
  reverseStrength?: number;
}

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
  channelId?: string
  channelTitle?: string
  localImageUrl?: string | null
  shortCode?: string | null
  hasCallToAction?: number | boolean
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
const NUM_PHYSICS_CONNECTIONS = 15 // Maximum number of connections per node for physics simulation
const SIMULATION_ITERATIONS = 500 // Run simulation to completion with this many ticks

const getNodeRadius = (videoCount: number, isCategory: boolean = false) => {
  const baseRadius = Math.max(8, Math.min(20, 8 + videoCount * 0.8))
  return isCategory ? baseRadius * 0.9 : baseRadius // Categories are slightly smaller
}

const getNodeSize = (vc: number, isCategory: boolean = false) => {
  const baseSize = Math.max(16, Math.min(40, 16 + vc * 1.6))
  return isCategory ? baseSize * 1.2 : baseSize // Categories are slightly bigger
}

const getMultiplierColor = (m: number) => {
  // Clamp the value between 0.5 and 2.0
  const clampedValue = Math.max(0.5, Math.min(2.0, m))
  
  let red, green, blue
  
  if (clampedValue < 1.0) {
    // First half: red to grey (0.5 -> 1.0)
    const t = (clampedValue - 0.5) / (1.0 - 0.5) // 0 to 1
    red = Math.round(255 * (1 - t * 0.5)) // 255 to 128
    green = Math.round(128 * t) // 0 to 128
    blue = Math.round(128 * t) // 0 to 128
  } else {
    // Second half: grey to green (1.0 -> 2.0)
    const t = (clampedValue - 1.0) / (2.0 - 1.0) // 0 to 1
    red = Math.round(128 * (1 - t)) // 128 to 0
    green = Math.round(128 + 127 * t) // 128 to 255
    blue = Math.round(128 * (1 - t)) // 128 to 0
  }
  
  const primary = `rgb(${red}, ${green}, ${blue})`
  
  // Create darker version for secondary color
  const darkRed = Math.round(red * 0.6)
  const darkGreen = Math.round(green * 0.6)
  const darkBlue = Math.round(blue * 0.6)
  const secondary = `rgb(${darkRed}, ${darkGreen}, ${darkBlue})`
  
  // Create glow with alpha
  const glow = `rgba(${red}, ${green}, ${blue}, 0.4)`
  
  return { primary, secondary, glow }
}

const getCategoryColor = () => {
  return { primary: "#8b5cf6", secondary: "#581c87", glow: "rgba(139, 92, 246, 0.4)" } // Purple for categories
}

const getCategoryBasedColor = (categoryColor: string) => {
  return { primary: categoryColor, secondary: categoryColor, glow: `${categoryColor}40` } // Use category color with 25% opacity glow
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
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [finalNodes, setFinalNodes] = useState<Topic[]>([])
  const [isSimulationComplete, setIsSimulationComplete] = useState(false)
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [selectedTopicVideos, setSelectedTopicVideos] = useState<Video[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [categoryView, setCategoryView] = useState(false)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const [addingVideoId, setAddingVideoId] = useState<string | null>(null)
  const [showAddChannelDialog, setShowAddChannelDialog] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<Video | null>(null)
  const [addedVideos, setAddedVideos] = useState<Set<string>>(new Set())
  const [sheetUrl, setSheetUrl] = useState<string | null>(null)
  const { toast } = useToast()
  
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

        const response = await fetch(`/api/topics/${encodeURIComponent(selectedTopicData.topic)}/videos?pageSize=9`)
        if (!response.ok) throw new Error('Failed to fetch videos')
        
        const data = await response.json()
        // Deduplicate videos by ID to prevent React key conflicts
        const videoMap = new Map<string, Video>()
        ;(data.videos || []).forEach((video: Video) => {
          if (!videoMap.has(video.id)) {
            videoMap.set(video.id, video)
          }
        })
        const uniqueVideos = Array.from(videoMap.values())
        setSelectedTopicVideos(uniqueVideos)
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
    
    for (let iter = 0; iter < iterations; iter++) {
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
    
    for (let iter = 0; iter < maxIterations; iter++) {
      let movedAny = false
      
      for (const node of nodesByStrength) {
        if (!node.x || !node.y) continue
        
        const nodeRadius = getNodeRadius(node.videoCount, node.isCategory)
        
        // Check for overlaps with other nodes
        for (const otherNode of processedNodes) {
          if (node.id === otherNode.id || !otherNode.x || !otherNode.y) continue
          
          const otherRadius = getNodeRadius(otherNode.videoCount, otherNode.isCategory)
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
            break // Only move away from first overlapping node per iteration
          }
        }
      }
      
      if (!movedAny) {
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
    
    return result
  }

  // Separate categories deterministically to ensure they stay far apart
  const separateCategories = (nodes: Topic[], minCategoryDistance = 800, maxIterations = 50) => {
    console.log('separateCategories called with:', nodes.length, 'nodes')
    const processedNodes = [...nodes]
    const categories = processedNodes.filter(n => n.isCategory)
    console.log('Found categories:', categories.length, categories.map(c => c.topic))
    
    if (categories.length <= 1) {
      console.log('Not enough categories to separate, returning early')
      return processedNodes
    }
    
    for (let iter = 0; iter < maxIterations; iter++) {
      let movedAny = false
      
      // Check each pair of categories
      for (let i = 0; i < categories.length; i++) {
        for (let j = i + 1; j < categories.length; j++) {
          const cat1 = categories[i]
          const cat2 = categories[j]
          
          if (!cat1.x || !cat1.y || !cat2.x || !cat2.y) continue
          
          const dx = cat1.x - cat2.x
          const dy = cat1.y - cat2.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance < minCategoryDistance) {
            console.log(`Moving categories apart: ${cat1.topic} and ${cat2.topic}, distance: ${distance}`)
            // Calculate separation vector - move each category half the needed distance
            const targetDistance = minCategoryDistance + 50 // Extra padding
            const moveDistance = (targetDistance - distance) / 2
            
            // Normalize direction vector
            const magnitude = Math.sqrt(dx * dx + dy * dy)
            const unitX = magnitude > 0 ? dx / magnitude : 1
            const unitY = magnitude > 0 ? dy / magnitude : 0
            
            // Move categories apart along the line connecting them
            cat1.x += unitX * moveDistance
            cat1.y += unitY * moveDistance
            cat2.x -= unitX * moveDistance  
            cat2.y -= unitY * moveDistance
            
            console.log(`After move - ${cat1.topic}: (${cat1.x}, ${cat1.y}), ${cat2.topic}: (${cat2.x}, ${cat2.y})`)
            movedAny = true
          }
        }
      }
      
      if (!movedAny) break
    }
    
    return processedNodes
  }

  // Assign hash-based deterministic positions
  const seededNodes = useMemo(() => {
    // Filter out any invalid topics first
    const validTopics = inputTopics.filter(t => t && t.id !== undefined && t.topic)
    console.log('All input topics:', inputTopics.map(t => ({ topic: t.topic, isCategory: t.isCategory })))
    
    const nodes = validTopics.map(t => {
      const pos = getRandomPosition(t.topic)
      return {
        ...t,
        x: pos.x,
        y: pos.y,
      }
    })

    const maxNodes = nodes.length
    
    // FIRST: Separate categories to ensure they stay far apart
    const categorySeparatedNodes = separateCategories(nodes, 5000*maxNodes/40, 500)

    // THEN: Apply preprocessing to move connected pairs closer
    const preprocessedNodes = preprocessConnectedPairs(categorySeparatedNodes, relationships, 0.5, 3)

    // FINALLY: Separate any overlapping nodes (but preserve category separation)
    const separatedNodes = separateOverlappingNodes(preprocessedNodes, relationships, 50)

    return separatedNodes
  }, [inputTopics, relationships])
  
  // Run simulation to completion asynchronously, then freeze
  useEffect(() => {
    if (!seededNodes.length) return

    // Filter out any invalid nodes before proceeding
    const validNodes = seededNodes.filter(n => n && n.id !== undefined && typeof n.x === 'number' && typeof n.y === 'number')
    if (validNodes.length === 0) return

    if (!ENABLE_MOVEMENT) {
      // Static mode: Use preprocessed positions directly
      setFinalNodes([...validNodes])
      setIsSimulationComplete(true)
      setIsSimulationRunning(false)
      return
    }

    // Start simulation loading state
    setIsSimulationRunning(true)
    setIsSimulationComplete(false)
    
    const nodeById = new Map(validNodes.map(n => [n.id, n]))
    const d3Links = filteredRelationships
      .filter(l => l && nodeById.has(l.source) && nodeById.has(l.target))
      .map(l => ({
        source: nodeById.get(l.source)!,
        target: nodeById.get(l.target)!,
        strength: l.strength,
      }))

    // Run simulation asynchronously to avoid blocking the UI
    setTimeout(() => {
      // Create a simulation optimized for maximum speed
      const simulation = d3
        .forceSimulation(validNodes as any)
        .randomSource(d3.randomLcg(1337))
        .force("charge", d3.forceManyBody()
          .strength(-50 * FORCE_STRENGTH) // Stronger forces for faster convergence
          .theta(0.8) // Lower theta for more accuracy during fast sim
        )
        .force(
          "link",
          d3
            .forceLink(d3Links as any)
            .id((d: any) => d.id)
            .distance(100)
            .strength(0.2 * FORCE_STRENGTH) // Stronger link forces
            .iterations(2) // More link iterations for stability
        )
        .force(
          "collide",
          d3
            .forceCollide()
            .radius((d: any) => getNodeRadius(d.videoCount, d.isCategory) + 5)
            .strength(0.8 * FORCE_STRENGTH) // Stronger collision
            .iterations(2) // More collision iterations
        )
        .alpha(0.8) // Higher initial alpha
        .alphaDecay(1 - Math.pow(0.001, 1 / 200)) // Faster decay
        .velocityDecay(0.7) // Higher velocity decay for stability
        .stop() // Don't start automatically

      // Run simulation to completion as fast as possible
      for (let i = 0; i < SIMULATION_ITERATIONS; ++i) {
        simulation.tick()
        if (simulation.alpha() < 0.005) break // Stop early if converged
      }

      // Store final positions and mark as complete
      const finalPositions = validNodes.map(n => ({ ...n, x: n.x || 0, y: n.y || 0 }))
      
      // Update state
      setFinalNodes(finalPositions)
      setIsSimulationComplete(true)
      setIsSimulationRunning(false)

      // Clean up
      simulation.stop()
    }, 10) // Small delay to allow UI to update with loading state

  }, [seededNodes, filteredRelationships])


  // Get connected node IDs for the selected topic (moved back to useMemo for React rendering)
  const connectedNodeIds = useMemo(() => {
    if (!selectedTopic) return new Set<number>()
    
    const connected = new Set<number>()
    filteredRelationships.forEach(rel => {
      if (rel.source === selectedTopic) connected.add(rel.target)
      if (rel.target === selectedTopic) connected.add(rel.source)
    })
    return connected
  }, [selectedTopic, filteredRelationships])

  // Setup zoom behavior and center the view when simulation is complete
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !isSimulationComplete || !finalNodes.length) return

    const svg = d3.select(svgRef.current)
    const g = d3.select(gRef.current)

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    // Store zoom behavior reference
    zoomBehaviorRef.current = zoom

    // Apply zoom behavior to SVG
    svg.call(zoom)

    // Set initial zoom to fit content
    const pad = 40
    const xs = finalNodes.map(n => n.x!)
    const ys = finalNodes.map(n => n.y!)
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad
    const maxY = Math.max(...ys) + pad
    
    // Get actual SVG dimensions
    const rect = svgRef.current.getBoundingClientRect()
    const width = rect.width || 800
    const height = rect.height || 500
    
    const dx = maxX - minX
    const dy = maxY - minY
    
    // Prevent division by zero
    if (dx === 0 || dy === 0) return
    
    const x = (minX + maxX) / 2
    const y = (minY + maxY) / 2
    const scale = Math.min(width / dx, height / dy) * 0.9
    
    // Ensure scale is valid
    if (!isFinite(scale) || scale <= 0) return
    
    const initialTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-x, -y)
    
    // Apply the initial transform through zoom behavior
    svg.call(zoom.transform, initialTransform)

    // Cleanup function to remove zoom behavior
    return () => {
      svg.on('.zoom', null)
      zoomBehaviorRef.current = null
    }
  }, [isSimulationComplete, finalNodes])


  const byId = useMemo(() => new Map(finalNodes.map(n => [n.id, n])), [finalNodes])

  // Zoom control functions
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().duration(300).call(
      zoomBehaviorRef.current.scaleBy, 1.5
    )
  }

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().duration(300).call(
      zoomBehaviorRef.current.scaleBy, 1 / 1.5
    )
  }

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current || !finalNodes.length) return
    
    // Deselect any selected topic
    onTopicSelect(null)
    
    const svg = d3.select(svgRef.current)
    
    // Calculate fit-to-content transform
    const pad = 40
    const xs = finalNodes.map(n => n.x!)
    const ys = finalNodes.map(n => n.y!)
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad
    const maxY = Math.max(...ys) + pad
    
    const rect = svgRef.current.getBoundingClientRect()
    const width = rect.width || 800
    const height = rect.height || 500
    
    const dx = maxX - minX
    const dy = maxY - minY
    
    if (dx === 0 || dy === 0) return
    
    const x = (minX + maxX) / 2
    const y = (minY + maxY) / 2
    const scale = Math.min(width / dx, height / dy) * 0.9
    
    if (!isFinite(scale) || scale <= 0) return
    
    const resetTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-x, -y)
    
    svg.transition().duration(750).call(
      zoomBehaviorRef.current.transform, resetTransform
    )
  }

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
    if (video.platform === 'instagram') {
      // For Instagram, always use the public reel link instead of rotating video URLs
      // Extract shortCode from the id (remove 'ig_' prefix) or use shortCode field if available
      const shortCode = video.shortCode || (video.id.startsWith('ig_') ? video.id.substring(3) : video.id)
      return `https://www.instagram.com/p/${shortCode}/`
    }
    if (video.platform === 'youtube') return `https://www.youtube.com/watch?v=${video.id}`
    if (video.videoUrl) return video.videoUrl
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

  const handleChannelClick = (video: Video, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent video click
    if (video.channelId) {
      router.push(`/dashboard/${video.channelId}`)
    }
  }

  async function addToSheet(video: Video) {
    if (!video.channelId) {
      toast({ title: "Error", description: "Missing channel information", variant: "destructive" });
      return;
    }
    setAddingVideoId(video.id)
    try {
      const videoLink = getVideoUrl(video)
      const res = await fetch('/api/drive/add-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: video.channelId,
          videoLink,
          viewCount: video.viewCount || 0
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
        description: `${pendingVideo.channelTitle || 'Channel'} has been added to the spreadsheet`
      })
      const videoLink = getVideoUrl(pendingVideo)
      const reelRes = await fetch('/api/drive/add-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: pendingVideo.channelId,
          videoLink,
          viewCount: pendingVideo.viewCount || 0
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

  return (
    <div className="space-y-6">
      <Card className="h-[600px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Topic Relationship Network
              </CardTitle>
              <CardDescription>
                Click nodes to explore topic relationships and view related videos. Use mouse wheel or zoom buttons to zoom, drag to pan.
              </CardDescription>
            </div>
            <Button
              variant={categoryView ? "default" : "outline"}
              onClick={() => setCategoryView(!categoryView)}
              className="shrink-0"
            >
              {categoryView ? "Performance View" : "Category View"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-full p-0">
          <div className="relative w-full h-[500px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg overflow-hidden">
            {/* Zoom Controls */}
            {isSimulationComplete && (
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleZoomIn}
                  className="w-8 h-8 p-0"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleZoomOut}
                  className="w-8 h-8 p-0"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetZoom}
                  className="w-8 h-8 p-0"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            )}
            {isSimulationRunning ? (
              // Loading spinner while simulation runs
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                  <p className="text-white text-sm">Rendering graph...</p>
                </div>
              </div>
            ) : isSimulationComplete ? (
              // Static graph after simulation completes
              <svg 
                ref={svgRef}
                width="100%" 
                height="100%" 
                viewBox="0 0 800 500" 
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                onClick={(e) => {
                  // Only deselect if clicking the background (not a node)
                  if (e.target === e.currentTarget || (e.target as Element).tagName === 'rect') {
                    onTopicSelect(null)
                  }
                }}
              >
                <defs>
                  {/* Background pattern */}
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148, 163, 184, 0.1)" strokeWidth="1"/>
                  </pattern>
                  
                  {/* Simple gradients for performance */}
                  <radialGradient id="nodeGradient">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.7" />
                  </radialGradient>
                </defs>
                
                {/* Background grid */}
                <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />
                
                <g ref={gRef} style={{ willChange: 'transform' }}>
                  {/* Links */}
                  {filteredRelationships.map((rel, i) => {
                    const a = byId.get(rel.source),
                      b = byId.get(rel.target)
                    if (!a || !b) return null
                    
                    const strength = rel.strength || 0
                    const strokeWidth = Math.max(1, Math.min(4, 1 + strength * 3))
                    const opacity = Math.max(0.3, Math.min(0.9, 0.4 + strength * 0.6))
                    
                    // Check if this connection involves the selected topic
                    const isConnectedToSelected = selectedTopic && (rel.source === selectedTopic || rel.target === selectedTopic)
                    
                    // Hide non-connected links when a topic is selected
                    if (selectedTopic && !isConnectedToSelected) {
                      return null
                    }
                    
                    return (
                      <path
                        key={i}
                        className="link-path"
                        d={pathFor(a, b)}
                        stroke={isConnectedToSelected ? "#60a5fa" : "#94a3b8"}
                        strokeWidth={isConnectedToSelected ? strokeWidth + 1 : strokeWidth * 0.5}
                        strokeOpacity={isConnectedToSelected ? 1 : opacity}
                        fill="none"
                        strokeLinecap="round"
                        style={{
                          transition: "stroke 0.2s ease, stroke-width 0.2s ease, stroke-opacity 0.2s ease"
                        }}
                      />
                    )
                  })}

                  {/* Nodes */}
                  {finalNodes.map(n => {
                    const size = getNodeSize(n.videoCount, n.isCategory)
                    const r = size / 2
                    const selected = selectedTopic === n.id
                    const connected = connectedNodeIds.has(n.id)
                    const dimmed = selectedTopic && !selected && !connected
                    
                    // Determine colors based on view mode
                    let colors;
                    if (n.isCategory) {
                      colors = getCategoryColor() // Categories always purple
                    } else if (categoryView && n.categoryColor) {
                      colors = getCategoryBasedColor(n.categoryColor) // Use category color in category view
                    } else {
                      colors = getMultiplierColor(n.engagementMultiplier) // Use performance colors in performance view
                    }
                    
                    let strokeColor = colors.primary
                    let strokeWidth = 2
                    
                    if (selected) {
                      strokeColor = "#fbbf24"
                      strokeWidth = 3
                    } else if (connected) {
                      strokeColor = "#60a5fa"
                      strokeWidth = 2.5
                    }
                    
                    return (
                      <g
                        key={n.id}
                        className="cursor-pointer node-group"
                        onClick={(e) => {
                          e.stopPropagation() // Prevent background click
                          onTopicSelect(selected ? null : n.id)
                        }}
                        style={{
                          transformOrigin: `${n.x ?? 0}px ${n.y ?? 0}px`,
                          transition: "transform 0.2s ease, opacity 0.2s ease",
                          willChange: "transform",
                          opacity: dimmed ? 0.4 : 1
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.1)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)"
                        }}
                      >
                      {/* Simplified outer ring for selected/connected nodes */}
                      {(selected || connected) && (
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={r + 4}
                          fill="none"
                          stroke={selected ? "#fbbf24" : "#60a5fa"}
                          strokeWidth="2"
                          strokeOpacity="0.5"
                        />
                      )}
                      
                      {/* Main node circle */}
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={r}
                        fill={colors.primary}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                      />
                      
                      
                      {/* Video count indicator - only for selected/connected nodes */}
                      {(selected || connected) && (
                        <>
                          <circle
                            cx={(n.x ?? 0) + r * 0.6}
                            cy={(n.y ?? 0) - r * 0.6}
                            r={Math.min(r * 0.3, 6)}
                            fill="#1f2937"
                            stroke="#f3f4f6"
                            strokeWidth="1"
                            style={{ pointerEvents: "none" }}
                          />
                          <text
                            x={(n.x ?? 0) + r * 0.6}
                            y={(n.y ?? 0) - r * 0.6}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-white font-bold pointer-events-none select-none"
                            style={{ fontSize: `${Math.max(5, r * 0.25)}px` }}
                          >
                            {n.videoCount}
                          </text>
                        </>
                      )}
                      
                      {/* Main topic text */}
                      <text
                        x={n.x ?? 0}
                        y={n.y ?? 0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white font-bold pointer-events-none select-none"
                        style={{ 
                          fontSize: `${Math.max(8, size / 8)}px`,
                          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                          transform: (selected || connected) ? 'translateY(-4px)' : 'none'
                        }}
                      >
                        {n.topic}
                      </text>
                      
                      {/* Engagement multiplier - only for selected/connected nodes */}
                      {(selected || connected) && (
                        <text
                          x={n.x ?? 0}
                          y={(n.y ?? 0) + 6}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-yellow-300 font-medium pointer-events-none select-none"
                          style={{ 
                            fontSize: `${Math.max(6, size / 10)}px`,
                            textShadow: "0 1px 2px rgba(0,0,0,0.9)"
                          }}
                        >
                          {n.engagementMultiplier.toFixed(2)}x
                        </text>
                      )}
                    </g>
                  )
                  })}
                </g>
              </svg>
            ) : (
              // Initial state before simulation starts
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-white text-sm">Preparing visualization...</div>
                </div>
              </div>
            )}
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
              Click video titles or external link icon to open videos. Click channel names to view their dashboard.
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
                    className="group p-4 border rounded-lg hover:shadow-md transition-all hover:border-blue-300"
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
                        <h4 
                          onClick={() => handleVideoClick(video)}
                          className="font-medium text-sm line-clamp-2 group-hover:text-blue-600 cursor-pointer hover:underline"
                        >
                          {video.title}
                          {video.hasCallToAction ? (
                            <Badge variant="destructive" className="ml-2">CTA</Badge>
                          ) : null}
                        </h4>
                        {video.channelTitle && (
                          <div 
                            onClick={(e) => handleChannelClick(video, e)}
                            className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-blue-600 cursor-pointer hover:underline w-fit"
                          >
                            <User className="h-3 w-3" />
                            <span className="truncate">{video.channelTitle}</span>
                          </div>
                        )}
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
                        <div className="flex justify-end mt-1">
                          <VideoSheetButton 
                            video={video} 
                            isAdded={addedVideos.has(video.id)} 
                            isLoading={addingVideoId === video.id} 
                            onAdd={() => addToSheet(video)} 
                            sheetUrl={sheetUrl} 
                            className="text-sm" 
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">
                            {video.platform === 'youtube' ? 'YouTube' : 'Instagram'}
                          </Badge>
                          <div 
                            onClick={() => handleVideoClick(video)}
                            className="cursor-pointer hover:text-blue-600"
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-blue-600" />
                          </div>
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
        </Card>
      )}
    </div>
  )
}
