"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { User, TrendingUp, Network, Settings, Clock, Play, Users, LogOut, FolderOpen } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { useJobs } from "@/hooks/useJobs"
import { useState } from "react"
import { useEffect } from "react"
import { Menu } from "lucide-react"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { runningJobs } = useJobs(1000)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

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
      router.push('/workspaces/new')
      return
    }
    if (id === 'none') {
      document.cookie = `workspaceId=; Path=/; Max-Age=0`
      setCurrentWorkspace(null)
      router.push('/no-workspace')
      return
    }

    // select existing
    document.cookie = `workspaceId=${encodeURIComponent(id)}; Path=/`;
    setCurrentWorkspace(id);
    router.push('/');
  }

  const navItems = [
    { href: "/", label: "Channels", icon: User },
    { href: "/suggested-channels", label: "Suggested Channels", icon: Users },
    { href: "/top-performing", label: "Top Performing", icon: TrendingUp },
    { href: "/connections-graph", label: "Connections Graph", icon: Network },
    { href: "/drive", label: "Drive", icon: FolderOpen },
    { href: "/criteria", label: "Criteria", icon: Settings },
    // Note: Schedule tab is not currently in use; keeping code for potential future re-enable
    // { href: "/schedule", label: "Schedule", icon: Clock },
    { href: "/jobs", label: `Jobs${activeJobsCount > 0 ? ` (${activeJobsCount})` : ""}`, icon: Play, hasActive: activeJobsCount > 0 },
  ]

  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-6 py-4">

        <nav className="flex items-center justify-between gap-2">
          {/* desktop nav */}
          <div className="hidden sm:flex gap-1.5 md:gap-2 flex-wrap">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`flex items-center gap-1.5 whitespace-nowrap text-xs md:text-sm ${item.hasActive ? "blue-shimmer" : ""}`}
                  >
                    <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* mobile: hamburger + logo area */}
          <div className="flex items-center gap-3 sm:hidden">
            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen((v) => !v)}
              className="p-2 rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* right-side controls (desktop) */}
          <div className="hidden sm:flex items-center gap-2 md:gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Select value={currentWorkspace ?? undefined} onValueChange={(val) => selectWorkspace(val)}>
                <SelectTrigger className="w-[160px] lg:w-[220px] h-8 md:h-9 text-xs md:text-sm">
                  <SelectValue placeholder="Select a workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">View all workspaces</SelectItem>
                  {workspaces.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                  <SelectItem value="create">+ create workspace...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 whitespace-nowrap text-xs md:text-sm"
            >
              <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4" />
              {isLoggingOut ? "Signing out..." : "Logout"}
            </Button>
          </div>

          {/* mobile menu panel */}
          {/** Keep this simple: render below nav when open on small screens */}
          <div className="sm:hidden mt-2 w-full">
            {typeof window !== 'undefined' && (
              mobileOpen ? (
                <div className="flex flex-col gap-2">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? "default" : "outline"}
                          className={`w-full justify-start flex items-center gap-2 whitespace-nowrap ${item.hasActive ? "blue-shimmer" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Button>
                      </Link>
                    )
                  })}

                  <div className="flex flex-col gap-2">
                    <Select value={currentWorkspace ?? undefined} onValueChange={(val) => selectWorkspace(val)}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="Select a workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">View all workspaces</SelectItem>
                        {workspaces.map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                        <SelectItem value="create">+ create workspace...</SelectItem>
                      </SelectContent>
                    </Select>

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
                  </div>
                </div>
              ) : null
            )}
          </div>
        </nav>
      </div>
    </div>
  )
}