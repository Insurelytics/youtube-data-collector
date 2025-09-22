"use client"

import { Navigation } from "./Navigation"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface PageLayoutProps {
  children: React.ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const router = useRouter()

  // Check for workspace selection
  useEffect(() => {
    if (isAuthenticated) {
      const match = document.cookie.match(/(?:^|; )workspaceId=([^;]+)/)
      const workspace = match ? decodeURIComponent(match[1]) : null
      setCurrentWorkspace(workspace)
      setWorkspaceLoading(false)
    }
  }, [isAuthenticated, router])

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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-6 pt-12 pb-6">
        {/* If no workspace is selected, redirect to no-workspace page */}
        {!currentWorkspace ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">No workspace selected</h2>
              <p className="text-gray-600 mb-4">Please select a workspace from the dropdown above</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
