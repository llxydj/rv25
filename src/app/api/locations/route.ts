import { NextResponse } from 'next/server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const NEGROS_OCCIDENTAL_CODE = '0645400000' // Negros Occidental Province Code

// Cache the data for 24 hours
const cache = new Map()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

async function fetchWithCache(url: string) {
  if (cache.has(url)) {
    const { data, timestamp } = cache.get(url)
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data
    }
    cache.delete(url)
  }

  const response = await fetch(url)
  const data = await response.json()
  cache.set(url, { data, timestamp: Date.now() })
  return data
}

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'locations:get'), 120)
    if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const cityCode = searchParams.get('cityCode')

    if (!type) {
      return NextResponse.json({ error: 'Type parameter is required' }, { status: 400 })
    }

    if (type === 'cities') {
      // Get all cities and municipalities in Negros Occidental
      const data = await fetchWithCache(
        `https://psgc.cloud/api/provinces/${NEGROS_OCCIDENTAL_CODE}/cities-municipalities`
      )
      return NextResponse.json(data)
    } else if (type === 'barangays' && cityCode) {
      // Get all barangays in a specific city/municipality
      const data = await fetchWithCache(
        `https://psgc.cloud/api/cities-municipalities/${cityCode}/barangays`
      )
      return NextResponse.json(data)
    } else {
      return NextResponse.json(
        { error: 'Invalid type or missing cityCode for barangays' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error fetching location data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location data' },
      { status: 500 }
    )
  }
} 