import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET: Fetch feedback for an announcement
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    if (!me?.user?.id) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const announcementId = searchParams.get('announcement_id')

    if (!announcementId) {
      return NextResponse.json({ success: false, message: 'announcement_id is required' }, { status: 400 })
    }

    // Get all feedback for this announcement
    const { data: feedback, error } = await supabase
      .from('announcement_feedback')
      .select(`
        id,
        rating,
        comment,
        created_at,
        user_id,
        users:user_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('announcement_id', announcementId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calculate statistics
    const ratings = feedback?.map(f => f.rating) || []
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0
    const ratingCounts = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: ratings.filter(r => r === star).length
    }))

    // Get user's own feedback if exists
    const { data: userFeedback } = await supabase
      .from('announcement_feedback')
      .select('id, rating, comment, created_at')
      .eq('announcement_id', announcementId)
      .eq('user_id', me.user.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        feedback: feedback || [],
        statistics: {
          total: feedback?.length || 0,
          average_rating: Math.round(avgRating * 10) / 10,
          rating_distribution: ratingCounts
        },
        user_feedback: userFeedback || null
      }
    })
  } catch (e: any) {
    console.error('Fetch feedback error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch feedback' }, { status: 500 })
  }
}

// POST: Submit feedback
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    if (!me?.user?.id) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json()
    const { announcement_id, rating, comment } = body

    if (!announcement_id || !rating) {
      return NextResponse.json({ success: false, message: 'announcement_id and rating are required' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, message: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    // Check if feedback already exists (upsert)
    const { data: existing } = await supabase
      .from('announcement_feedback')
      .select('id')
      .eq('announcement_id', announcement_id)
      .eq('user_id', me.user.id)
      .maybeSingle()

    if (existing) {
      // Update existing feedback
      const { data, error } = await supabase
        .from('announcement_feedback')
        .update({
          rating,
          comment: comment || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data, message: 'Feedback updated successfully' })
    } else {
      // Insert new feedback
      const { data, error } = await supabase
        .from('announcement_feedback')
        .insert({
          announcement_id,
          user_id: me.user.id,
          rating,
          comment: comment || null
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data, message: 'Feedback submitted successfully' })
    }
  } catch (e: any) {
    console.error('Submit feedback error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to submit feedback' }, { status: 500 })
  }
}

// DELETE: Remove feedback
export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    if (!me?.user?.id) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const announcementId = searchParams.get('announcement_id')

    if (!announcementId) {
      return NextResponse.json({ success: false, message: 'announcement_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('announcement_feedback')
      .delete()
      .eq('announcement_id', announcementId)
      .eq('user_id', me.user.id)

    if (error) throw error
    return NextResponse.json({ success: true, message: 'Feedback removed successfully' })
  } catch (e: any) {
    console.error('Delete feedback error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to remove feedback' }, { status: 500 })
  }
}

