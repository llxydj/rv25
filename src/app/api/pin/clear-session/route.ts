import { NextResponse } from 'next/server'

export const dynamic = "force-dynamic"

export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // Clear PIN verification cookies
  response.cookies.delete('pin_verified')
  response.cookies.delete('pin_verified_at')
  
  return response
}

