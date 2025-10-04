import React from "react"
import { Button } from "@/components/ui/button"
import { ExternalLink, Loader2, File } from "lucide-react"

interface VideoSheetButtonProps {
  video: any
  isAdded: boolean
  isLoading: boolean
  onAdd: () => void
  sheetUrl?: string | null
  className?: string
}

export function VideoSheetButton({ video, isAdded, isLoading, onAdd, sheetUrl, className }: VideoSheetButtonProps) {
  if (isAdded) {
    return (
      <Button asChild variant="ghost" size="sm" className={className}>
        <a 
          href={sheetUrl || '#'} 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Go to 10X10"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Go to 10X10
        </a>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      title="Add to 10X10"
      disabled={isLoading}
      onClick={onAdd}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <File className="h-3 w-3 mr-1" />
      )}
      Add to 10X10
    </Button>
  )
}
