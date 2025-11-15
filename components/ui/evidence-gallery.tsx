import * as React from "react"
import { Download, Eye, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface EvidenceItem {
  id: string
  type: "image" | "video" | "document"
  url: string
  name: string
  size?: string
  uploadedAt?: Date
  thumbnailUrl?: string
}

interface EvidenceGalleryProps {
  items: EvidenceItem[]
  onPreview?: (item: EvidenceItem) => void
  onDownload?: (item: EvidenceItem) => void
  onDelete?: (item: EvidenceItem) => void
  className?: string
}

const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({
  items,
  onPreview,
  onDownload,
  onDelete,
  className,
}) => {
  const getFileIcon = (type: EvidenceItem["type"]) => {
    switch (type) {
      case "image":
        return "📷"
      case "video":
        return "🎥"
      case "document":
        return "📄"
      default:
        return "📎"
    }
  }

  const formatDate = (date?: Date) => {
    if (!date) return ""
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  }

  return (
    <div className={cn("evidence-container", className)}>
      {items.map((item) => (
        <div key={item.id} className="evidence-item">
          {item.type === "image" ? (
            <img 
              src={item.url} 
              alt={item.name}
              className="cursor-pointer"
              onClick={() => onPreview?.(item)}
            />
          ) : item.type === "video" ? (
            <div 
              className="bg-muted flex items-center justify-center cursor-pointer"
              onClick={() => onPreview?.(item)}
            >
              <div className="text-4xl">🎥</div>
            </div>
          ) : (
            <div 
              className="document-preview cursor-pointer"
              onClick={() => onPreview?.(item)}
            >
              <div className="text-4xl">{getFileIcon(item.type)}</div>
            </div>
          )}
          
          <div className="evidence-info">
            <h4 className="font-medium text-sm truncate" title={item.name}>
              {item.name}
            </h4>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{item.size}</span>
              <span>{formatDate(item.uploadedAt)}</span>
            </div>
          </div>
          
          <div className="evidence-actions">
            <button
              onClick={() => onPreview?.(item)}
              className="p-1 rounded hover:bg-muted"
              aria-label="Preview"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDownload?.(item)}
              className="p-1 rounded hover:bg-muted"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete?.(item)}
              className="p-1 rounded hover:bg-muted text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export { EvidenceGallery, type EvidenceItem }