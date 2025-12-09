type RateKey = string

const windowMs = 60_000
const defaultLimit = 60

// SECURITY NOTE: In-memory rate limiting resets on server restart
// For production with multiple instances, consider using Supabase database
// or Redis for persistent, distributed rate limiting
// Current implementation is suitable for single-instance deployments
const hitCounts = new Map<RateKey, { count: number; expiresAt: number }>()

export function rateLimitAllowed(key: RateKey, limit: number = defaultLimit) {
  const now = Date.now()
  const record = hitCounts.get(key)
  if (!record || record.expiresAt < now) {
    hitCounts.set(key, { count: 1, expiresAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfter: 0 }
  }
  if (record.count >= limit) {
    const retryAfter = Math.max(0, Math.ceil((record.expiresAt - now) / 1000))
    return { allowed: false, remaining: 0, retryAfter }
  }
  record.count += 1
  return { allowed: true, remaining: Math.max(0, limit - record.count), retryAfter: 0 }
}

export function rateKeyFromRequest(req: Request, scope: string) {
  try {
    const url = new URL(req.url)
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "anon").split(",")[0].trim()
    return `${scope}:${ip}:${url.pathname}`
  } catch {
    return `${scope}:unknown`
  }
}





