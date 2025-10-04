export function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function thumbUrlFrom(thumbnails: any): string {
  try {
    const t = typeof thumbnails === 'string' ? JSON.parse(thumbnails) : thumbnails
    return t?.medium?.url || t?.default?.url || t?.high?.url || ""
  } catch {
    return ""
  }
}

export function getImageUrl(video: any): string {
  // For Instagram reels, prioritize locally downloaded image to avoid CORS issues
  if (video.platform === 'instagram' && video.localImageUrl) {
    return video.localImageUrl
  }
  
  const thumbnailUrl = thumbUrlFrom(video.thumbnails)
  if (thumbnailUrl) return thumbnailUrl
  
  return "/placeholder.svg"
}

export function getImageClasses(video: any, size: 'small' | 'medium' | 'large' = 'medium'): string {
  const baseClasses = "object-cover rounded"
  
  if (video.platform === 'instagram') {
    // Instagram images are 9:16 (portrait) - keep consistent height, adjust width to be narrower
    switch (size) {
      case 'small':
        return `w-4 h-7 ${baseClasses}` // Narrower for 9:16 aspect ratio
      case 'medium':
        return `w-5 h-9 ${baseClasses}` // 5:9 ratio preserves Instagram proportions  
      case 'large':
        return `w-8 h-14 ${baseClasses}` // 8:14 ≈ 4:7 keeps portrait feel but reasonable width
    }
  } else {
    // YouTube images are 16:9 (landscape) - keep existing widths
    switch (size) {
      case 'small':
        return `w-12 h-7 ${baseClasses}` // 12:7 ≈ 16:9.3 ratio
      case 'medium':
        return `w-16 h-9 ${baseClasses}` // 16:9 ratio
      case 'large':
        return `w-24 h-14 ${baseClasses}` // 24:14 ≈ 12:7 ≈ 16:9.3 ratio
    }
  }
}

export function getPostUrl(video: any): string {
  if (video.videoUrl) return video.videoUrl
  if (video.platform === 'instagram') {
    const identifier = video.shortCode || video.id
    return `https://www.instagram.com/p/${identifier}/`
  }
  return `https://www.youtube.com/watch?v=${video.id || 'dQw4w9WgXcQ'}`
}

export function cleanTitle(title: string): string {
  if (!title) return title
  // Remove hashtags from title for display
  return title.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim()
}
