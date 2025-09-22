"use client"

import { Navigation } from "./Navigation"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Database, Plus } from "lucide-react"

interface PageLayoutProps {
  children: React.ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(true)
  const router = useRouter()

  // Check for workspace selection
  useEffect(() => {
    if (isAuthenticated) {
      const match = document.cookie.match(/(?:^|; )workspaceId=([^;]+)/)
      const workspace = match ? decodeURIComponent(match[1]) : null
      setCurrentWorkspace(workspace)
      setWorkspaceLoading(false)

      // Load available workspaces for the empty state UI
      ;(async () => {
        try {
          const res = await fetch('/api/workspaces', { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            setWorkspaces(data.workspaces || [])
          }
        } catch (_) {
        } finally {
          setWorkspacesLoading(false)
        }
      })()
    }
  }, [isAuthenticated, router])

  // If authenticated and no workspace selected, redirect to no-workspace
  useEffect(() => {
    if (!isLoading && !workspaceLoading && isAuthenticated && !currentWorkspace) {
      router.push('/no-workspace')
    }
  }, [isLoading, workspaceLoading, isAuthenticated, currentWorkspace, router])

  // Show loading spinner while checking authentication
  if (isLoading || workspaceLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // If not authenticated, the useAuth hook will redirect to login
  // This component won't render if user is not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Do not render wrapped content while redirecting due to missing workspace
  if (!currentWorkspace) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-6 pt-12 pb-6">
        {children}
      </div>
    </div>
  )
}
