"use client"

import { ReactNode } from "react"
import { useAuth } from "@/hooks/useAuth"

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading spinner while checking authentication
  if (isLoading) {
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

  return <>{children}</>
}
