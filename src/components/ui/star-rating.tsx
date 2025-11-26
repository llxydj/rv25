"use client"

import { Star } from "lucide-react"
import { useState } from "react"

interface StarRatingProps {
  rating: number
  onRatingChange?: (rating: number) => void
  maxRating?: number
  size?: "sm" | "md" | "lg"
  readonly?: boolean
  showLabel?: boolean
}

export function StarRating({
  rating,
  onRatingChange,
  maxRating = 5,
  size = "md",
  readonly = false,
  showLabel = true
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0)

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  }

  const iconSize = sizeClasses[size]

  const handleClick = (value: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(value)
    }
  }

  const handleMouseEnter = (value: number) => {
    if (!readonly) {
      setHoverRating(value)
    }
  }

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0)
    }
  }

  const displayRating = hoverRating || rating

  const getRatingLabel = (rating: number) => {
    if (rating === 0) return "Not rated"
    if (rating === 1) return "Poor"
    if (rating === 2) return "Fair"
    if (rating === 3) return "Good"
    if (rating === 4) return "Very Good"
    if (rating === 5) return "Excellent"
    return `${rating} stars`
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: maxRating }, (_, index) => {
          const starValue = index + 1
          const isFilled = starValue <= displayRating
          const isHovered = starValue <= hoverRating

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => handleMouseEnter(starValue)}
              onMouseLeave={handleMouseLeave}
              disabled={readonly}
              className={`
                transition-all duration-150 ease-in-out
                ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
                ${isFilled ? 'text-yellow-400' : 'text-gray-300'}
                ${isHovered ? 'scale-110' : ''}
                focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 rounded
              `}
              aria-label={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
            >
              <Star
                className={`${iconSize} ${isFilled ? 'fill-current' : ''}`}
                strokeWidth={isFilled ? 1 : 2}
              />
            </button>
          )
        })}
        {showLabel && rating > 0 && (
          <span className="ml-2 text-sm font-medium text-gray-700">
            {getRatingLabel(rating)}
          </span>
        )}
      </div>
      {!readonly && showLabel && (
        <p className="text-xs text-gray-500">
          {hoverRating > 0 ? `Click to rate ${getRatingLabel(hoverRating)}` : 'Click to rate'}
        </p>
      )}
    </div>
  )
}
