// Platform-agnostic type definitions for multi-platform scraper

export type Platform = 'youtube' | 'instagram'

export interface BasePlatformData {
  platform: Platform
  id: string
  title: string
  handle: string
  thumbnailUrl?: string
  isActive: boolean
  lastSyncedAt?: string
}

export interface BaseContentData {
  id: string
  platform: Platform
  title: string
  url: string
  publishedAt: string
  thumbnailUrl?: string
  engagementScore?: number
}

// YouTube specific types
export interface YouTubeChannel extends BasePlatformData {
  platform: 'youtube'
  subscriberCount: number
  videoCount: number
  totalViews: number
  avgViews: number
  viralVideoCount: number
}

export interface YouTubeVideo extends BaseContentData {
  platform: 'youtube'
  channelId: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds?: number
  thumbnails?: string
}

// Instagram specific types
export interface InstagramProfile extends BasePlatformData {
  platform: 'instagram'
  followerCount?: number
  postCount: number
  totalLikes: number
  avgLikes: number
  viralPostCount: number
}

export interface InstagramPost extends BaseContentData {
  platform: 'instagram'
  profileId: string
  type: 'Video' | 'Photo' | 'Carousel'
  shortCode: string
  caption: string
  hashtags: string[]
  mentions: string[]
  likesCount: number
  commentsCount: number
  displayUrl: string
  videoUrl?: string
  localVideoPath?: string
}

// Unified types for UI components
export type PlatformChannel = YouTubeChannel | InstagramProfile
export type PlatformContent = YouTubeVideo | InstagramPost

// Platform configuration
export interface PlatformConfig {
  name: string
  icon: string
  color: string
  metrics: {
    primary: string // subscriber/follower count
    secondary: string // video/post count
    engagement: string // views/likes
    viral: string // viral multiplier description
  }
  urlPattern: RegExp
  extractHandle: (input: string) => string
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  youtube: {
    name: 'YouTube',
    icon: 'Play',
    color: 'red',
    metrics: {
      primary: 'subscribers',
      secondary: 'videos',
      engagement: 'views',
      viral: 'x subscriber count for viral videos'
    },
    urlPattern: /(?:youtube\.com\/(?:@|channel\/|c\/)|youtu\.be\/)/,
    extractHandle: (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) return ""
      if (trimmed.startsWith("@")) return trimmed
      try {
        const url = new URL(trimmed)
        const seg = url.pathname.split("/").filter(Boolean).pop() || ""
        return seg.startsWith("@") ? seg : ""
      } catch {
        return ""
      }
    }
  },
  instagram: {
    name: 'Instagram',
    icon: 'Camera',
    color: 'purple',
    metrics: {
      primary: 'followers',
      secondary: 'posts',
      engagement: 'likes',
      viral: 'x follower count for viral posts'
    },
    urlPattern: /instagram\.com\//,
    extractHandle: (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) return ""
      if (trimmed.startsWith("@")) return trimmed
      try {
        const url = new URL(trimmed)
        const segments = url.pathname.split("/").filter(Boolean)
        const username = segments[0]
        return username ? `@${username}` : ""
      } catch {
        return ""
      }
    }
  }
}

// Analytics criteria types
export interface AnalyticsCriteria {
  viralMultiplier: number
  commentWeight: number
  likeWeight: number
  timeRange: string
}

// Dashboard data types
export interface DashboardData {
  channel: PlatformChannel
  trends: any[]
  top: {
    views: PlatformContent[]
    likes: PlatformContent[]
    comments: PlatformContent[]
  }
  special: PlatformContent[] // viral content
}

// API response types
export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}
