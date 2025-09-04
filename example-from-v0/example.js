"use client"

import { ArrowLeft, TrendingUp, TrendingDown, Flame, Star } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

// Mock data for topics with multiplier values
const topicsData = [
  {
    id: 1,
    topic: "Artificial Intelligence",
    engagementMultiplier: 4.2,
    videoCount: 45,
    avgViews: 2800000,
    trend: "up",
    trendChange: 0.23,
    category: "Technology",
    isHot: true,
    description: "AI content is generating 4x more engagement than average",
  },
  {
    id: 2,
    topic: "iPhone 15 Pro",
    engagementMultiplier: 3.8,
    videoCount: 23,
    avgViews: 3200000,
    trend: "up",
    trendChange: 0.18,
    category: "Technology",
    isHot: true,
    description: "Latest iPhone reviews driving massive engagement boost",
  },
  {
    id: 3,
    topic: "Gaming Setup",
    engagementMultiplier: 2.4,
    videoCount: 67,
    avgViews: 1500000,
    trend: "up",
    trendChange: 0.12,
    category: "Gaming",
    isHot: false,
    description: "Setup videos performing 2.4x better than baseline",
  },
  {
    id: 4,
    topic: "Recipe Tutorial",
    engagementMultiplier: 1.8,
    videoCount: 89,
    avgViews: 850000,
    trend: "stable",
    trendChange: 0.02,
    category: "Cooking",
    isHot: false,
    description: "Solid above-average performance in cooking content",
  },
  {
    id: 5,
    topic: "Budget Tech",
    engagementMultiplier: 1.4,
    videoCount: 34,
    avgViews: 1200000,
    trend: "down",
    trendChange: -0.08,
    category: "Technology",
    isHot: false,
    description: "Moderate engagement boost, trending down",
  },
  {
    id: 6,
    topic: "Streaming Tips",
    engagementMultiplier: 1.2,
    videoCount: 28,
    avgViews: 950000,
    trend: "up",
    trendChange: 0.15,
    category: "Gaming",
    isHot: false,
    description: "Slight engagement boost with growing interest",
  },
]

export default function HotTopics2Page() {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getMultiplierColor = (multiplier: number) => {
    if (multiplier >= 1.2) return "text-green-600"
    if (multiplier >= 0.8) return "text-yellow-600"
    return "text-red-600"
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Technology":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "Gaming":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "Cooking":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "up":
        return "text-green-600 bg-green-50"
      case "down":
        return "text-red-600 bg-red-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  const formatMultiplier = (multiplier: number) => {
    return `${multiplier.toFixed(1)}x`
  }

  // Convert multiplier to progress bar percentage (capped at 5x for display)
  const getProgressValue = (multiplier: number) => {
    return Math.min((multiplier / 5) * 100, 100)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/hot-topics">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Hot Topics
            </Button>
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Hot Topics - Visual Cards</h1>
          </div>
          <p className="text-muted-foreground">
            Visual card layout showing engagement multipliers and trending indicators
          </p>
        </div>

        {/* Hot Topics Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="h-6 w-6 text-orange-500" />
            <h2 className="text-2xl font-semibold">High Impact Topics</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {topicsData
              .filter((topic) => topic.isHot)
              .map((topic) => (
                <Card
                  key={topic.id}
                  className="relative overflow-hidden border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50"
                >
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-orange-500 text-white">
                      <Flame className="h-3 w-3 mr-1" />
                      Hot
                    </Badge>
                  </div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{topic.topic}</CardTitle>
                        <CardDescription className="mt-1">{topic.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getCategoryColor(topic.category)}>
                        {topic.category}
                      </Badge>
                      <Badge variant="outline" className={getTrendColor(topic.trend)}>
                        {topic.trend === "up" ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {topic.trendChange > 0 ? "+" : ""}
                        {(topic.trendChange * 100).toFixed(0)}%
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Engagement Multiplier</span>
                          <span className={`font-semibold ${getMultiplierColor(topic.engagementMultiplier)}`}>
                            {formatMultiplier(topic.engagementMultiplier)}
                          </span>
                        </div>
                        <Progress value={getProgressValue(topic.engagementMultiplier)} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1">
                          {topic.engagementMultiplier >= 1.2
                            ? "Above Average"
                            : topic.engagementMultiplier >= 0.8
                              ? "Near Average"
                              : "Below Average"}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Videos</p>
                          <p className="font-semibold">{topic.videoCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Views</p>
                          <p className="font-semibold">{formatNumber(topic.avgViews)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>

        {/* All Topics Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold">All Topics</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topicsData.map((topic) => (
              <Card key={topic.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{topic.topic}</CardTitle>
                    <Badge variant="outline" className={getCategoryColor(topic.category)}>
                      {topic.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Multiplier</span>
                      <span className={`font-semibold ${getMultiplierColor(topic.engagementMultiplier)}`}>
                        {formatMultiplier(topic.engagementMultiplier)}
                      </span>
                    </div>
                    <Progress value={getProgressValue(topic.engagementMultiplier)} className="h-1.5" />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      {topic.trend === "up" ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : topic.trend === "down" ? (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      ) : (
                        <div className="h-3 w-3" />
                      )}
                      <span
                        className={
                          topic.trend === "up"
                            ? "text-green-600"
                            : topic.trend === "down"
                              ? "text-red-600"
                              : "text-gray-600"
                        }
                      >
                        {topic.trendChange > 0 ? "+" : ""}
                        {(topic.trendChange * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-muted-foreground">{topic.videoCount} videos</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
