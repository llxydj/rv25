import { NextResponse } from 'next/server'

// TEMPORARY: bypass entire PIN system
export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'PIN system temporarily disabled'
  })
}
