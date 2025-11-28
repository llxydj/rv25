import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const pinVerified = cookieStore.get('pin_verified')
    const pinVerifiedAt = cookieStore.get('pin_verified_at')

    // Check if PIN verification cookie exists and is valid
    if (pinVerified?.value === 'true' && pinVerifiedAt?.value) {
      const verifiedAt = parseInt(pinVerifiedAt.value)
      const now = Date.now()
      const hoursSinceVerification = (now - verifiedAt) / (1000 * 60 * 60)

      // PIN verification is valid for 24 hours
      if (hoursSinceVerification < 24) {
        return NextResponse.json({ 
          verified: true,
          verifiedAt: verifiedAt
        })
      }
    }

    return NextResponse.json({ verified: false })
  } catch (error: any) {
    console.error('PIN check verified error:', error)
    return NextResponse.json({ verified: false })
  }
}

