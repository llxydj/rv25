// src/lib/fetch-with-timeout.ts
// Utility for fetch requests with timeout support
// Critical for mobile devices with slow/unstable connections

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number // Timeout in milliseconds (default: 30000 = 30 seconds)
}

/**
 * Fetch with timeout - prevents hanging requests on slow mobile networks
 * @param url Request URL
 * @param options Fetch options including timeout
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options

  // Create AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      // User-friendly timeout message
      const timeoutSeconds = Math.round(timeout / 1000)
      throw new Error(`Connection timeout after ${timeoutSeconds} seconds. Please check your internet connection and try again.`)
    }
    
    // Re-throw other errors
    throw error
  }
}

/**
 * Fetch JSON with timeout
 */
export async function fetchJsonWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<any> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  return response.json()
}

