"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { User, TrendingUp, Network, Settings, Clock, Play, Users, LogOut } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { useJobs } from "@/hooks/useJobs"
import { useState } from "react"
import { useEffect } from "react"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { runningJobs } = useJobs(1000)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)

  // Calculate active jobs count (running + queued/pending)
  const activeJobsCount = runningJobs.filter(job => job.status === 'running' || job.status === 'queued').length

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (res.ok) {
        router.push("/login")
        router.refresh()
      }
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    // Read current workspace from cookie
    const match = document.cookie.match(/(?:^|; )workspaceId=([^;]+)/);
    setCurrentWorkspace(match ? decodeURIComponent(match[1]) : null);

    // Fetch available workspaces
    (async () => {
      try {
        const res = await fetch('/api/workspaces', {
          credentials: 'include'
        });
        if (!res.ok) {
          console.error('Workspace fetch failed:', res.status);
          return;
        }
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      } catch (e) {
        console.error('Failed to fetch workspaces:', e);
      }
    })();
  }, [])

  const selectWorkspace = async (id: string) => {
    if (id === 'create') {
      const idInput = prompt('Workspace id (no spaces):');
      if (!idInput) return;
      const name = prompt('Workspace display name:') || idInput;
      try {
        const res = await fetch('/api/workspaces', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          credentials: 'include',
          body: JSON.stringify({ id: idInput, name }) 
        });
        if (res.ok) {
          document.cookie = `workspaceId=${encodeURIComponent(idInput)}; Path=/`;
          setCurrentWorkspace(idInput);
          location.reload();
        } else {
          alert('Failed to create workspace');
        }
      } catch (e) { alert('Failed to create workspace'); }
      return;
    }

    // select existing
    document.cookie = `workspaceId=${encodeURIComponent(id)}; Path=/`;
    setCurrentWorkspace(id);
    location.reload();
  }

  const navItems = [
    { href: "/", label: "Channels", icon: User },
    { href: "/suggested-channels", label: "Suggested Channels", icon: Users },
    { href: "/top-performing", label: "Top Performing", icon: TrendingUp },
    { href: "/connections-graph", label: "Connections Graph", icon: Network },
    { href: "/criteria", label: "Criteria", icon: Settings },
    // Note: Schedule tab is not currently in use; keeping code for potential future re-enable
    // { href: "/schedule", label: "Schedule", icon: Clock },
    { href: "/jobs", label: `Jobs${activeJobsCount > 0 ? ` (${activeJobsCount})` : ""}`, icon: Play, hasActive: activeJobsCount > 0 },
  ]

  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-6 py-4">

        <nav className="flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex gap-2 overflow-x-auto">
            <div className="flex items-center gap-2">
              <label className="text-sm mr-2">Workspace:</label>
              <select value={currentWorkspace || ''} onChange={(e) => selectWorkspace(e.target.value)} className="rounded border px-2 py-1 text-sm">
                <option value="">-- none --</option>
                {workspaces.map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.id})</option>
                ))}
                <option value="create">+ create workspace...</option>
              </select>
            </div>
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
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Signing out..." : "Logout"}
          </Button>
        </nav>
      </div>
    </div>
  )
}