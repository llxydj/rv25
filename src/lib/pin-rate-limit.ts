/**
 * PIN Rate Limiting and Brute Force Protection
 */

const MAX_ATTEMPTS = 5 // Max attempts per window
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes
const MAX_LOCKOUT_ATTEMPTS = 10 // Lock account after 10 failed attempts

interface PinAttemptResult {
  allowed: boolean
  locked: boolean
  lockedUntil: Date | null
  attemptsRemaining: number
  message: string
}

export async function checkPinRateLimit(
  supabase: any,
  userId: string
): Promise<PinAttemptResult> {
  try {
    // Get current attempt record
    const { data: attemptData, error } = await supabase
      .from('pin_attempts')
      .select('attempt_count, last_attempt_at, locked_until')
      .eq('user_id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking PIN attempts:', error)
      return {
        allowed: false,
        locked: false,
        lockedUntil: null,
        attemptsRemaining: 0,
        message: 'Error checking rate limit'
      }
    }

    const now = new Date()
    const lockedUntil = attemptData?.locked_until ? new Date(attemptData.locked_until) : null

    // Check if account is locked
    if (lockedUntil && lockedUntil > now) {
      const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / (60 * 1000))
      return {
        allowed: false,
        locked: true,
        lockedUntil,
        attemptsRemaining: 0,
        message: `Account locked due to too many failed attempts. Try again in ${minutesRemaining} minute(s).`
      }
    }

    // Check if lockout period has passed
    if (lockedUntil && lockedUntil <= now) {
      // Clear lockout
      await supabase
        .from('pin_attempts')
        .update({ 
          attempt_count: 0,
          locked_until: null,
          last_attempt_at: now.toISOString()
        })
        .eq('user_id', userId)
    }

    const attemptCount = attemptData?.attempt_count || 0
    const lastAttemptAt = attemptData?.last_attempt_at ? new Date(attemptData.last_attempt_at) : null

    // Check if within rate limit window
    if (lastAttemptAt) {
      const timeSinceLastAttempt = now.getTime() - lastAttemptAt.getTime()
      
      // If within window and exceeded attempts
      if (timeSinceLastAttempt < ATTEMPT_WINDOW_MS && attemptCount >= MAX_ATTEMPTS) {
        const minutesRemaining = Math.ceil((ATTEMPT_WINDOW_MS - timeSinceLastAttempt) / (60 * 1000))
        return {
          allowed: false,
          locked: false,
          lockedUntil: null,
          attemptsRemaining: 0,
          message: `Too many attempts. Please wait ${minutesRemaining} minute(s) before trying again.`
        }
      }

      // If window has passed, reset count
      if (timeSinceLastAttempt >= ATTEMPT_WINDOW_MS) {
        await supabase
          .from('pin_attempts')
          .update({ 
            attempt_count: 0,
            last_attempt_at: now.toISOString()
          })
          .eq('user_id', userId)
      }
    }

    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - attemptCount)

    return {
      allowed: true,
      locked: false,
      lockedUntil: null,
      attemptsRemaining,
      message: ''
    }
  } catch (error: any) {
    console.error('Rate limit check error:', error)
    return {
      allowed: false,
      locked: false,
      lockedUntil: null,
      attemptsRemaining: 0,
      message: 'Error checking rate limit'
    }
  }
}

export async function recordPinAttempt(
  supabase: any,
  userId: string,
  success: boolean
): Promise<void> {
  try {
    const now = new Date()

    if (success) {
      // Clear attempts on success
      await supabase
        .from('pin_attempts')
        .delete()
        .eq('user_id', userId)
      return
    }

    // Get current attempt record
    const { data: attemptData } = await supabase
      .from('pin_attempts')
      .select('attempt_count')
      .eq('user_id', userId)
      .maybeSingle()

    const newAttemptCount = (attemptData?.attempt_count || 0) + 1
    const shouldLock = newAttemptCount >= MAX_LOCKOUT_ATTEMPTS
    const lockedUntil = shouldLock 
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : null

    // Upsert attempt record
    await supabase
      .from('pin_attempts')
      .upsert({
        user_id: userId,
        attempt_count: newAttemptCount,
        last_attempt_at: now.toISOString(),
        locked_until: lockedUntil?.toISOString() || null,
        updated_at: now.toISOString()
      }, {
        onConflict: 'user_id'
      })

    // Log lockout for admin notification (optional)
    if (shouldLock) {
      console.warn(`⚠️ Account locked due to PIN brute force: ${userId}`)
      // TODO: Send admin notification
    }
  } catch (error: any) {
    console.error('Error recording PIN attempt:', error)
  }
}

