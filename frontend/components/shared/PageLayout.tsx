"use client"

import { Navigation } from "./Navigation"

interface PageLayoutProps {
  children: React.ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-6 pt-12 pb-6">
        {children}
      </div>
    </div>
  )
}
