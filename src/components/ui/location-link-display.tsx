"use client"

import { MapPin, ExternalLink } from "lucide-react"

interface LocationLinkDisplayProps {
  location: string
  className?: string
}

export function LocationLinkDisplay({ location, className = "" }: LocationLinkDisplayProps) {
  if (!location) return null

  // Check if location is a Google Maps URL
  const isGoogleMapsUrl = location.includes('google.com/maps') || location.includes('maps.google.com') || location.startsWith('https://maps.app.goo.gl/') || location.startsWith('http://maps.app.goo.gl/')

  // If it's a Google Maps URL, make it clickable
  if (isGoogleMapsUrl) {
    // Ensure URL has protocol
    const url = location.startsWith('http://') || location.startsWith('https://') 
      ? location 
      : `https://${location}`

    return (
      <div className={`flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 ${className}`}>
        <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all flex items-center gap-1"
          >
            <span className="line-clamp-2">{location}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to open in Google Maps</p>
        </div>
      </div>
    )
  }

  // If it's a regular address, show it with a button to search on Google Maps
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`

  return (
    <div className={`flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 ${className}`}>
      <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</p>
        <p className="text-sm text-gray-900 dark:text-gray-100 mb-2 break-words">{location}</p>
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          <span>Open in Google Maps</span>
        </a>
      </div>
    </div>
  )
}

