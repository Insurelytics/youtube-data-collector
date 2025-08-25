import { Platform, PlatformChannel, PlatformContent, PLATFORM_CONFIGS } from '@/types/platform'

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function extractHandle(input: string, platform: Platform): string {
  return PLATFORM_CONFIGS[platform].extractHandle(input)
}

export function getPlatformFromUrl(url: string): Platform | null {
  for (const [platform, config] of Object.entries(PLATFORM_CONFIGS)) {
    if (config.urlPattern.test(url)) {
      return platform as Platform
    }
  }
  return null
}

// Platform-agnostic thumbnail URL extraction
export function getThumbnailUrl(content: PlatformContent): string {
  if (content.platform === 'youtube') {
    try {
      const thumbnails = content.thumbnails
      if (typeof thumbnails === 'string') {
        const parsed = JSON.parse(thumbnails)
        return parsed?.medium?.url || parsed?.default?.url || parsed?.high?.url || "/placeholder.svg"
      }
      return thumbnails?.medium?.url || thumbnails?.default?.url || thumbnails?.high?.url || "/placeholder.svg"
    } catch {
      return "/placeholder.svg"
    }
  } else if (content.platform === 'instagram') {
    const post = content as any // Instagram post
    return post.displayUrl || "/placeholder.svg"
  }
  return "/placeholder.svg"
}

// Platform-agnostic engagement metrics
export function getEngagementMetrics(content: PlatformContent) {
  if (content.platform === 'youtube') {
    const video = content as any
    return {
      primary: { icon: 'Eye', value: video.viewCount || 0, label: 'views' },
      secondary: { icon: 'MessageCircle', value: video.commentCount || 0, label: 'comments' },
      tertiary: { icon: 'Heart', value: video.likeCount || 0, label: 'likes' }
    }
  } else if (content.platform === 'instagram') {
    const post = content as any
    return {
      primary: { icon: 'Heart', value: post.likesCount || 0, label: 'likes' },
      secondary: { icon: 'MessageCircle', value: post.commentsCount || 0, label: 'comments' },
      tertiary: { icon: 'Eye', value: 0, label: 'views' } // Instagram doesn't provide view count in our data
    }
  }
  return {
    primary: { icon: 'Eye', value: 0, label: 'engagement' },
    secondary: { icon: 'MessageCircle', value: 0, label: 'comments' },
    tertiary: { icon: 'Heart', value: 0, label: 'likes' }
  }
}

// Platform-agnostic channel metrics
export function getChannelMetrics(channel: PlatformChannel) {
  if (channel.platform === 'youtube') {
    return {
      primary: { icon: 'Users', value: channel.subscriberCount || 0, label: 'subscribers' },
      secondary: { icon: 'Play', value: channel.videoCount || 0, label: 'videos' },
      tertiary: { icon: 'Eye', value: channel.totalViews || 0, label: 'total views' },
      viral: { icon: 'Flame', value: channel.viralVideoCount || 0, label: 'viral' }
    }
  } else if (channel.platform === 'instagram') {
    return {
      primary: { icon: 'Users', value: channel.followerCount || 0, label: 'followers' },
      secondary: { icon: 'Camera', value: channel.postCount || 0, label: 'posts' },
      tertiary: { icon: 'Heart', value: channel.totalLikes || 0, label: 'total likes' },
      viral: { icon: 'Flame', value: channel.viralPostCount || 0, label: 'viral' }
    }
  }
  return {
    primary: { icon: 'Users', value: 0, label: 'followers' },
    secondary: { icon: 'FileText', value: 0, label: 'content' },
    tertiary: { icon: 'TrendingUp', value: 0, label: 'engagement' },
    viral: { icon: 'Flame', value: 0, label: 'viral' }
  }
}

// Platform-agnostic URL generation
export function getContentUrl(content: PlatformContent): string {
  if (content.platform === 'youtube') {
    return `https://www.youtube.com/watch?v=${content.id}`
  } else if (content.platform === 'instagram') {
    const post = content as any
    return post.url || `https://www.instagram.com/p/${post.shortCode}/`
  }
  return content.url || '#'
}

// Calculate engagement score (platform-agnostic)
export function calculateEngagementScore(content: PlatformContent, criteria: { likeWeight: number, commentWeight: number }): number {
  const metrics = getEngagementMetrics(content)
  const primary = metrics.primary.value || 0
  const comments = (metrics.secondary.value || 0) * criteria.commentWeight
  const likes = (metrics.tertiary.value || 0) * criteria.likeWeight
  
  return primary + comments + likes
}

// Check if content is viral (platform-agnostic)
export function isViralContent(content: PlatformContent, channel: PlatformChannel, viralMultiplier: number): boolean {
  if (content.platform === 'youtube' && channel.platform === 'youtube') {
    const subscriberCount = Number(channel.subscriberCount || 0)
    const viewCount = Number((content as any).viewCount || 0)
    return viewCount >= subscriberCount * viralMultiplier
  } else if (content.platform === 'instagram' && channel.platform === 'instagram') {
    const followerCount = Number(channel.followerCount || 0)
    const likesCount = Number((content as any).likesCount || 0)
    return likesCount >= followerCount * viralMultiplier
  }
  return false
}

// Platform-agnostic content duration
export function getContentDuration(content: PlatformContent): string {
  if (content.platform === 'youtube') {
    const video = content as any
    return video.durationSeconds ? `${Math.round(video.durationSeconds/60)}m` : ''
  }
  // Instagram doesn't provide duration in our current data structure
  return ''
}

// Get platform color
export function getPlatformColor(platform: Platform): string {
  return PLATFORM_CONFIGS[platform].color
}

// Get platform icon
export function getPlatformIcon(platform: Platform): string {
  return PLATFORM_CONFIGS[platform].icon
}
