"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as d3 from "d3"
import { Network } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

function getRandomPosition(topic: string, width = 600, height = 400) {
  const seed = hashStringToSeed(topic)
  // Simple LCG (Linear Congruential Generator) for deterministic random
  const a = 1664525
  const c = 1013904223
  const m = Math.pow(2, 32)
  
  const x = ((a * seed + c) % m) / m
  const y = ((a * (seed + 1) + c) % m) / m
  
  return {
    x: x * width + 100,  // 100px padding
    y: y * height + 100
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

  const links = useMemo(() => relationships.map(r => ({ ...r })), [relationships])

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

    console.log("Starting topic locations:")
    nodes.forEach(n =>
      console.log(`${n.topic}: x=${n.x?.toFixed(2)}, y=${n.y?.toFixed(2)}`)
    )
    return nodes
  }, [inputTopics])

  useEffect(() => {
    if (!seededNodes.length) return
    simRef.current?.stop()

    const nodeById = new Map(seededNodes.map(n => [n.id, n]))
    const d3Links = links
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
      .force("charge", d3.forceManyBody().strength(-60).theta(0.9))
      .force(
        "link",
        d3
          .forceLink(d3Links as any)
          .id((d: any) => d.id)
          .distance(150)
          .strength((l: any) => 0.25 * (l.strength ?? 1))
      )
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d: any) => getNodeRadius(d.videoCount) + 8)
          .iterations(2)
      )
      .force("center", d3.forceCenter(400, 250))
      .alpha(1)
      .alphaDecay(1 - Math.pow(0.001, 1 / 60))
      .on("tick", () => {
        tickCount++
        if (tickCount % 2 === 0) setNodes([...seededNodes])
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

  return (
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
              {relationships.map((rel, i) => {
                const a = byId.get(rel.source),
                  b = byId.get(rel.target)
                if (!a || !b) return null
                
                const strength = rel.strength || 0
                const strokeWidth = Math.max(0.5, Math.min(3, 0.5 + strength * 4))
                const opacity = Math.max(0.2, Math.min(0.8, 0.3 + strength * 0.7))
                
                return (
                  <path
                    key={i}
                    d={pathFor(a, b)}
                    stroke="#64748b"
                    strokeWidth={strokeWidth}
                    strokeOpacity={opacity}
                    fill="none"
                  />
                )
              })}

              {/* Nodes */}
              {nodes.map(n => {
                const size = getNodeSize(n.videoCount)
                const r = size / 2
                const selected = selectedTopic === n.id
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
                      style={{
                        filter: selected
                          ? "drop-shadow(0 0 8px rgba(0,0,0,0.35))"
                          : "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                      }}
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
  )
}
