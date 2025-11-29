import L from "leaflet"

/**
 * Shared map icon utility for consistent marker styling across all map components
 * Provides teardrop/droplet-shaped pins for incidents and user locations
 */

export type MarkerType = 'incident' | 'volunteer' | 'user'

export type IncidentStatus = 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED'

/**
 * Get color based on incident status
 */
export const getIncidentColor = (status: string): string => {
  switch (status.toUpperCase()) {
    case 'PENDING': return '#ef4444' // Red
    case 'ASSIGNED': return '#f59e0b' // Amber
    case 'RESPONDING': return '#3b82f6' // Blue
    case 'RESOLVED': return '#10b981' // Green
    case 'CANCELLED': return '#6b7280' // Gray
    default: return '#6b7280' // Gray (default)
  }
}

/**
 * Create a teardrop/droplet-shaped map pin icon
 * This is the main icon style for incidents and user locations
 */
export const createTeardropPinIcon = (
  color: string,
  type: 'incident' | 'user' = 'incident',
  size: { width: number; height: number } = { width: 32, height: 40 }
): L.DivIcon => {
  const { width, height } = size
  const anchorX = width / 2
  const anchorY = height

  // Create SVG for teardrop shape with inner circle indicator
  // Using a cleaner teardrop path that creates a proper pin shape
  // Generate a truly unique ID to avoid conflicts with multiple markers
  // Use performance.now() and a counter for better uniqueness
  const uniqueId = `pin-${color.replace('#', '').replace(/[^a-zA-Z0-9]/g, '')}-${performance.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`
  
  // Create the SVG as a string - ensure proper escaping
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <!-- Teardrop shape - classic map pin -->
      <path d="M ${anchorX} ${height} 
              L ${width * 0.2} ${height * 0.7} 
              Q ${width * 0.15} ${height * 0.55} ${width * 0.2} ${height * 0.4}
              Q ${width * 0.25} ${height * 0.25} ${anchorX} ${height * 0.12}
              Q ${width * 0.75} ${height * 0.25} ${width * 0.8} ${height * 0.4}
              Q ${width * 0.85} ${height * 0.55} ${width * 0.8} ${height * 0.7}
              Z" 
            fill="${color}" 
            stroke="white" 
            stroke-width="2.5" 
            filter="url(#shadow-${uniqueId})"
            style="stroke-linejoin: round; stroke-linecap: round;"/>
      <!-- Inner circle indicator for better visibility -->
      <circle cx="${anchorX}" cy="${height * 0.48}" r="${width * 0.18}" fill="white" opacity="0.95"/>
    </svg>
  `.trim()
  
  // Debug logging in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[createTeardropPinIcon] Created icon:', {
      color,
      size: { width, height },
      anchor: { x: anchorX, y: anchorY },
      uniqueId,
      svgLength: svg.length
    })
  }

  const icon = L.divIcon({
    html: svg,
    className: 'custom-teardrop-pin',
    iconSize: [width, height],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -anchorY],
  })
  
  // Force icon to be visible - ensure it has proper styling
  if (icon.options.html) {
    // Add inline styles to ensure visibility
    const htmlWithStyles = icon.options.html.replace(
      '<svg',
      '<svg style="display: block; pointer-events: none;"'
    )
    icon.options.html = htmlWithStyles
  }
  
  return icon
}

/**
 * Create a circular marker icon (for volunteers)
 * Keeps the existing circular design which is already good
 */
export const createCircularIcon = (
  color: string,
  size: number = 20,
  borderWidth: number = 3
): L.DivIcon => {
  const iconHtml = `
    <div style="
      background-color: ${color}; 
      width: ${size}px; 
      height: ${size}px; 
      border-radius: 50%; 
      border: ${borderWidth}px solid white; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `

  return L.divIcon({
    html: iconHtml,
    className: 'custom-circular-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

/**
 * Main icon creation function - unified interface for all marker types
 */
export const createCustomIcon = (
  color: string,
  type: MarkerType,
  status?: string
): L.DivIcon => {
  switch (type) {
    case 'incident':
      // Use teardrop pin for incidents
      return createTeardropPinIcon(color, 'incident')
    
    case 'user':
      // Use teardrop pin for user location
      return createTeardropPinIcon(color, 'user')
    
    case 'volunteer':
      // Keep circular design for volunteers
      return createCircularIcon(color, 20, 3)
    
    default:
      // Default to teardrop pin
      return createTeardropPinIcon(color, 'incident')
  }
}

/**
 * Convenience function to create incident icon with status
 */
export const createIncidentIcon = (status: string): L.DivIcon => {
  const color = getIncidentColor(status)
  return createTeardropPinIcon(color, 'incident')
}

/**
 * Convenience function to create user location icon
 */
export const createUserIcon = (): L.DivIcon => {
  return createTeardropPinIcon('#3b82f6', 'user')
}

/**
 * Convenience function to create volunteer icon
 */
export const createVolunteerIcon = (color: string = '#10b981'): L.DivIcon => {
  return createCircularIcon(color, 20, 3)
}

