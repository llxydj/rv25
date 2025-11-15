// Talisay City, Negros Occidental boundaries (approximate)
// These coordinates define a polygon that encompasses Talisay City
// Expanded to cover the full city area including all barangays
export const TALISAY_BOUNDARIES = [
  [10.7800, 123.0000], // Northeast (expanded)
  [10.7800, 122.9000], // Northwest (expanded)
  [10.6800, 122.9000], // Southwest (expanded)
  [10.6800, 123.0000], // Southeast (expanded)
  [10.7800, 123.0000], // Close the polygon
]

// Center of Talisay City
export const TALISAY_CENTER: [number, number] = [10.7302, 122.9455]

// Check if a point is within the Talisay City boundaries
export const isWithinTalisayCity = (lat: number, lng: number): boolean => {
  // Prefer polygon-based guard automatically if polygon is present
  if (typeof window !== 'undefined') {
    try {
      const polygon = (window as any).__TALISAY_POLYGON__ as [number, number][] | undefined
      if (polygon && polygon.length > 3) {
        return pointInPolygon([lat, lng], polygon)
      }
    } catch {
      // fall through to bounding box
    }
  }

  // Fallback: expanded bounding box to cover all of Talisay City
  const TALISAY_BOUNDS = { north: 10.7800, south: 10.6800, east: 123.0000, west: 122.9000 }
  return lat <= TALISAY_BOUNDS.north && lat >= TALISAY_BOUNDS.south && lng <= TALISAY_BOUNDS.east && lng >= TALISAY_BOUNDS.west
}

// Ray-casting algorithm for point-in-polygon
export function pointInPolygon(point: [number, number], vs: [number, number][]) {
  const x = point[0], y = point[1]
  let inside = false
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1]
    const xj = vs[j][0], yj = vs[j][1]

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Calculate distance between two points in kilometers
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371 // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1)
  const dLng = deg2rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c // Distance in km
  return d
}

// Convert degrees to radians
const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180)
}

// Format coordinates for display
export const formatCoordinates = (lat: number, lng: number): string => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

// Get address from coordinates using reverse geocoding
export const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RVOIS-Capstone-Project/1.0 (Contact: jlcbelonio.chmsu@gmail.com, janlloydbelonio@gmail.com, https://github.com/llxydj)'
        }
      }
    )
    const data = await response.json()

    if (data && data.display_name) {
      return data.display_name
    }

    return null
  } catch (error) {
    console.error("Error getting address from coordinates:", error)
    return null
  }
}
