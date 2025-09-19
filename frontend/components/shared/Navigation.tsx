"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, TrendingUp, Network, Settings, Clock, Play, Users } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { useJobs } from "@/hooks/useJobs"

export function Navigation() {
  const pathname = usePathname()
  const { runningJobs } = useJobs(1000)
  
  // Calculate active jobs count (running + queued/pending)
  const activeJobsCount = runningJobs.filter(job => job.status === 'running' || job.status === 'queued').length

  const navItems = [
    { href: "/", label: "Channels", icon: User },
    { href: "/suggested-channels", label: "Suggested Channels", icon: Users },
    { href: "/top-performing", label: "Top Performing", icon: TrendingUp },
    { href: "/connections-graph", label: "Connections Graph", icon: Network },
    { href: "/criteria", label: "Criteria", icon: Settings },
    { href: "/schedule", label: "Schedule", icon: Clock },
    { href: "/jobs", label: `Jobs${activeJobsCount > 0 ? ` (${activeJobsCount})` : ""}`, icon: Play, hasActive: activeJobsCount > 0 },
  ]

  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-6 py-4">
        
        <nav className="flex gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link key={item.href} href={item.href}>
                <Button 
                  variant={isActive ? "default" : "outline"} 
                  className={`flex items-center gap-2 whitespace-nowrap ${item.hasActive ? "blue-shimmer" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}