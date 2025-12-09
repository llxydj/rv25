/**
 * Simple CSRF Protection Utility
 * Validates Origin/Referer headers to prevent CSRF attacks
 */

export function validateCSRF(request: Request): { valid: boolean; error?: string } {
  // Skip CSRF check for GET/HEAD/OPTIONS requests (safe methods)
  const method = request.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true }
  }

  // Get origin and referer headers
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  // In development, allow localhost
  const isDevelopment = process.env.NODE_ENV === 'development'
  const allowedOrigins = isDevelopment
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : [
        process.env.NEXT_PUBLIC_APP_URL || 'https://rvois.vercel.app',
        'https://rvois.vercel.app',
      ]

  // Validate origin header (preferred)
  if (origin) {
    try {
      const originUrl = new URL(origin)
      const isValidOrigin = allowedOrigins.some(allowed => {
        try {
          const allowedUrl = new URL(allowed)
          return originUrl.origin === allowedUrl.origin
        } catch {
          return false
        }
      })

      if (!isValidOrigin) {
        return { valid: false, error: 'Invalid origin header' }
      }
    } catch {
      // Invalid origin URL format
      return { valid: false, error: 'Invalid origin format' }
    }
  } else if (referer) {
    // Fallback to referer if origin is not present
    try {
      const refererUrl = new URL(referer)
      const isValidReferer = allowedOrigins.some(allowed => {
        try {
          const allowedUrl = new URL(allowed)
          return refererUrl.origin === allowedUrl.origin
        } catch {
          return false
        }
      })

      if (!isValidReferer) {
        return { valid: false, error: 'Invalid referer header' }
      }
    } catch {
      return { valid: false, error: 'Invalid referer format' }
    }
  } else {
    // No origin or referer - reject in production, allow in development
    if (!isDevelopment) {
      return { valid: false, error: 'Missing origin/referer header' }
    }
  }

  return { valid: true }
}

