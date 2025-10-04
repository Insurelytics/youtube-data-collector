import React from "react"
import { Eye, MessageCircle, Heart, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { VideoSheetButton } from "./VideoSheetButton"
import { formatNumber, formatDate, getImageUrl, getImageClasses, getPostUrl, cleanTitle } from "@/lib/video-utils"

interface VideoCardProps {
  video: any
  variant?: "large" | "table-row" | "compact"
  rank?: number
  isViral?: boolean
  isAdded?: boolean
  isLoading?: boolean
  onAdd?: () => void
  sheetUrl?: string | null
}

function CtaBadge({ video }: { video: any }) {
  if (!video?.hasCallToAction) return null
  return <Badge variant="destructive" className="ml-2">CTA</Badge>
}

export function VideoCard({
  video,
  variant = "large",
  rank,
  isViral = false,
  isAdded = false,
  isLoading = false,
  onAdd,
  sheetUrl
}: VideoCardProps) {
  const handleClick = () => window.open(getPostUrl(video), '_blank', 'noopener,noreferrer')

  // Compact variant (for collapsibles)
  if (variant === "compact") {
    return (
      <div 
        onClick={handleClick}
        className="p-2 bg-muted/30 rounded text-xs cursor-pointer hover:bg-muted/50 transition-colors group"
      >
        <div className="flex items-start justify-between mb-1">
          <div className="font-medium line-clamp-2 group-hover:text-blue-600 flex-1 pr-2">
            {cleanTitle(video.title)}
            <CtaBadge video={video} />
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-blue-600 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="h-2 w-2" />
            {formatNumber(video.views || video.viewCount || 0)}
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="h-2 w-2" />
            {formatNumber(video.comments || video.commentCount || 0)}
          </div>
          <div className="flex items-center gap-1">
            <Heart className="h-2 w-2" />
            {formatNumber(video.likes || video.likeCount || 0)}
          </div>
        </div>
        {onAdd && (
          <div className="flex justify-end mt-1" onClick={(e) => e.stopPropagation()}>
            <VideoSheetButton 
              video={video} 
              isAdded={isAdded} 
              isLoading={isLoading} 
              onAdd={onAdd} 
              sheetUrl={sheetUrl} 
              className="mt-1 text-xs h-5 px-2" 
            />
          </div>
        )}
      </div>
    )
  }

  // Table row variant
  if (variant === "table-row") {
    return (
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            <a href={getPostUrl(video)} target="_blank" rel="noopener noreferrer">
              <img 
                src={getImageUrl(video)}
                alt={video.title}
                className={getImageClasses(video, 'medium')}
              />
            </a>
            <div>
              <p className="font-medium line-clamp-2 max-w-xs">
                <a href={getPostUrl(video)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {cleanTitle(video.title)}
                </a>
                <CtaBadge video={video} />
              </p>
              <p className="text-sm text-muted-foreground">
                {video.durationSeconds ? `${Math.round(video.durationSeconds/60)}m` : ''}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell>{formatDate(video.publishedAt)}</TableCell>
        <TableCell>{formatNumber(video.viewCount || 0)}</TableCell>
        <TableCell>{formatNumber(video.commentCount || 0)}</TableCell>
        <TableCell>{formatNumber(video.likeCount || 0)}</TableCell>
        <TableCell className="w-32">
          {onAdd && (
            <VideoSheetButton 
              video={video} 
              isAdded={isAdded} 
              isLoading={isLoading} 
              onAdd={onAdd} 
              sheetUrl={sheetUrl} 
              className="" 
            />
          )}
        </TableCell>
      </TableRow>
    )
  }

  // Large variant (default)
  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg">
      <div 
        className="flex-shrink-0 cursor-pointer" 
        onClick={handleClick}
      >
        <img 
          src={getImageUrl(video)}
          alt={video.title}
          className={getImageClasses(video, 'large')}
        />
      </div>
      <div 
        className="flex-1 cursor-pointer" 
        onClick={handleClick}
      >
        <h3 className="font-semibold line-clamp-2">
          <span className="hover:underline block">
            {cleanTitle(video.title)}
          </span>
          <CtaBadge video={video} />
        </h3>
        <p className="text-sm text-muted-foreground">{formatDate(video.publishedAt)}</p>
        {isViral && (
          <Badge variant="destructive" className="mt-1">
            Viral Video
          </Badge>
        )}
        <div className="flex items-center gap-4 text-sm mt-2">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatNumber(video.viewCount || 0)}
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {formatNumber(video.commentCount || 0)}
          </div>
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {formatNumber(video.likeCount || 0)}
          </div>
        </div>
      </div>
      {onAdd && (
        <div className="text-right">
          <VideoSheetButton 
            video={video} 
            isAdded={isAdded} 
            isLoading={isLoading} 
            onAdd={onAdd} 
            sheetUrl={sheetUrl} 
            className="mt-2" 
          />
        </div>
      )}
    </div>
  )
}
