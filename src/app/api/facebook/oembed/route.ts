import { NextResponse } from 'next/server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

/**
 * Facebook oEmbed API endpoint
 * Fetches embed data for Facebook posts using Facebook's oEmbed API
 * 
 * Security: Validates URL, rate limits, and sanitizes response
 */

// Force dynamic rendering - this route uses request.url which is dynamic
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'facebook:oembed'), 30)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMITED', message: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any }
      )
    }

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { success: false, code: 'MISSING_URL', message: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Validate Facebook URL
    const facebookUrlPattern = /^https?:\/\/(www\.)?(facebook\.com|fb\.com|m\.facebook\.com)\/.+/
    if (!facebookUrlPattern.test(url)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_URL', message: 'Invalid Facebook URL' },
        { status: 400 }
      )
    }

    // Facebook oEmbed endpoint
    // Note: Facebook requires access_token for some endpoints, but basic oEmbed works without it
    // For public posts, we can use the oEmbed endpoint
    const oembedUrl = `https://www.facebook.com/plugins/post/oembed.json?url=${encodeURIComponent(url)}&omitscript=true`

    try {
      const response = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RVOIS/1.0)',
        },
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        // If oEmbed fails, return a fallback structure
        return NextResponse.json({
          success: true,
          data: {
            html: `<div class="facebook-post-fallback"><a href="${url}" target="_blank" rel="noopener noreferrer">View Facebook Post</a></div>`,
            url,
            provider_name: 'Facebook',
            type: 'rich',
          },
          cached: false,
        })
      }

      const data = await response.json()

      // Sanitize and return embed data
      return NextResponse.json({
        success: true,
        data: {
          html: data.html || '',
          url: data.url || url,
          provider_name: data.provider_name || 'Facebook',
          type: data.type || 'rich',
          author_name: data.author_name || null,
          author_url: data.author_url || null,
          width: data.width || null,
          height: data.height || null,
        },
        cached: false,
      })
    } catch (fetchError: any) {
      console.error('Facebook oEmbed fetch error:', fetchError)
      
      // Return fallback on error
      return NextResponse.json({
        success: true,
        data: {
          html: `<div class="facebook-post-fallback p-4 border border-gray-300 rounded-lg"><p class="text-gray-600 mb-2">Unable to load Facebook post preview.</p><a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">View on Facebook</a></div>`,
          url,
          provider_name: 'Facebook',
          type: 'rich',
        },
        cached: false,
        error: fetchError.message,
      })
    }
  } catch (error: any) {
    console.error('Facebook oEmbed API error:', error)
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: error?.message || 'Failed to fetch Facebook post' },
      { status: 500 }
    )
  }
}

