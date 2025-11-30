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
  const timeoutId = setTimeout(() => {
    console.warn(`[fetchWithTimeout] Request timeout after ${timeout}ms:`, url)
    controller.abort()
  }, timeout)

  const requestStartTime = Date.now()
  
  try {
    console.log(`[fetchWithTimeout] Starting request:`, {
      url,
      method: fetchOptions.method || 'GET',
      timeout: `${timeout}ms`,
      timestamp: new Date().toISOString()
    })
    
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    
    const elapsed = Date.now() - requestStartTime
    clearTimeout(timeoutId)
    
    console.log(`[fetchWithTimeout] Request completed:`, {
      url,
      elapsed: `${elapsed}ms`,
      status: response.status,
      ok: response.ok
    })
    
    return response
  } catch (error: any) {
    const elapsed = Date.now() - requestStartTime
    clearTimeout(timeoutId)
    
    console.error(`[fetchWithTimeout] Request failed:`, {
      url,
      elapsed: `${elapsed}ms`,
      error: error.message,
      name: error.name,
      cause: error.cause
    })
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      // Check if it was our timeout or a network issue
      const wasTimeout = elapsed >= timeout - 100 // Allow 100ms buffer
      if (wasTimeout) {
        console.error(`[fetchWithTimeout] Request timed out after ${elapsed}ms (limit: ${timeout}ms)`)
      } else {
        console.error(`[fetchWithTimeout] Request was aborted early (${elapsed}ms) - possible network issue`)
      }
      
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

