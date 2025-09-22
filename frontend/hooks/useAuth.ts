"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Check authentication by calling a protected endpoint
      const res = await fetch("/api/health", {
        method: "GET",
        credentials: "include", // Include cookies
      })

      if (res.ok) {
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
        // Only redirect if we're not already on the login page
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          router.push("/login")
        }
      }
    } catch (error) {
      setIsAuthenticated(false)
      // Only redirect if we're not already on the login page
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        router.push("/login")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isAuthenticated,
    isLoading,
    checkAuth
  }
}
