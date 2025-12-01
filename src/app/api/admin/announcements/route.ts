import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AnnouncementCreateSchema, AnnouncementUpdateSchema, AnnouncementDeleteSchema } from '@/lib/validation'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { getServerSupabase } from '@/lib/supabase-server'
import { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type AnnouncementInsert = Database['public']['Tables']['announcements']['Insert']
type AnnouncementUpdate = Database['public']['Tables']['announcements']['Update']

async function getClientWithToken(request: Request) {
  // Extract token from Authorization header
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) throw new Error('Missing access token')
  return getServerSupabase()
}

async function assertAdmin(supabase: ReturnType<typeof createClient<Database>>, userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()
  if (error || data?.role !== 'admin') {
    throw new Error('Only admins can manage announcements')
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getClientWithToken(request)

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'admin:announcements:post'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = AnnouncementCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { title, content, type, priority, location, date, time, requirements, facebook_post_url, source_type } = parsed.data

    // Authenticated user
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) throw new Error('Not authenticated')
    const userId = userRes.user.id
    await assertAdmin(supabase, userId)

    // If Facebook URL is provided, fetch embed data
    let facebookEmbedData = null
    if (facebook_post_url) {
      try {
        const origin = new URL(request.url).origin
        const oembedRes = await fetch(`${origin}/api/facebook/oembed?url=${encodeURIComponent(facebook_post_url)}`)
        if (oembedRes.ok) {
          const oembedJson = await oembedRes.json()
          if (oembedJson.success && oembedJson.data) {
            facebookEmbedData = oembedJson.data
          }
        }
      } catch (fetchError) {
        console.warn('Failed to fetch Facebook oEmbed data:', fetchError)
        // Continue without embed data - will use fallback
      }
    }

    const payload: AnnouncementInsert = {
      title,
      content,
      type,
      priority: typeof priority === 'number' ? String(priority) : priority,
      location,
      date,
      time,
      requirements: Array.isArray(requirements) ? requirements : typeof requirements === 'string' ? [requirements] : null,
      created_by: userId,
      facebook_post_url: facebook_post_url || null,
      facebook_embed_data: facebookEmbedData,
      source_type: source_type || (facebook_post_url ? 'FACEBOOK' : 'MANUAL'),
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create announcement' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getClientWithToken(request)

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'admin:announcements:put'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = AnnouncementUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { id, title, content, type, priority, location, date, time, requirements, facebook_post_url, source_type } = parsed.data

    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) throw new Error('Not authenticated')
    await assertAdmin(supabase, userRes.user.id)

    // If Facebook URL is provided, fetch embed data
    let facebookEmbedData = null
    if (facebook_post_url) {
      try {
        const origin = new URL(request.url).origin
        const oembedRes = await fetch(`${origin}/api/facebook/oembed?url=${encodeURIComponent(facebook_post_url)}`)
        if (oembedRes.ok) {
          const oembedJson = await oembedRes.json()
          if (oembedJson.success && oembedJson.data) {
            facebookEmbedData = oembedJson.data
          }
        }
      } catch (fetchError) {
        console.warn('Failed to fetch Facebook oEmbed data:', fetchError)
        // Continue without embed data - will use fallback
      }
    }

    const payload: AnnouncementUpdate = {
      title,
      content,
      type,
      priority,
      location,
      date,
      time,
      requirements,
      facebook_post_url: facebook_post_url || null,
      facebook_embed_data: facebookEmbedData,
      source_type: source_type || (facebook_post_url ? 'FACEBOOK' : 'MANUAL'),
    }

    const { data, error } = await supabase
      .from('announcements')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to update announcement' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getClientWithToken(request)

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'admin:announcements:delete'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = AnnouncementDeleteSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { id: announcementId } = parsed.data
    const id = String(announcementId)

    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) throw new Error('Not authenticated')
    await assertAdmin(supabase, userRes.user.id)

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to delete announcement' }, { status: 500 })
  }
}
