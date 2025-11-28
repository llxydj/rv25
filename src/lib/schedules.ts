import { supabase } from "./supabase"

export const ACTIVITY_TYPES = [
  'OUTREACH_PROGRAM',
  'SCHOOL_VISIT',
  'COMMUNITY_VISIT',
  'DISASTER_PREPAREDNESS',
  'RESCUE_TRAINING',
  'EMERGENCY_DRILL',
  'AWARENESS_CAMPAIGN',
  'EQUIPMENT_TRAINING',
  'TEAM_BUILDING',
  'OTHER'
] as const

export type ActivityType = typeof ACTIVITY_TYPES[number]

// Types for schedule management
interface CreateScheduleInput {
  volunteer_id: string;
  title: ActivityType | string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  barangay?: string;
}

interface UpdateScheduleInput extends Partial<CreateScheduleInput> {
  id: string;
}

// Create a new schedule (admin only)
export const createSchedule = async (adminId: string, input: CreateScheduleInput) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    const res = await fetch('/api/admin/schedules', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ ...input }),
    })
    const json = await res.json()
    if (!res.ok || !json?.success) throw new Error(json?.message || res.statusText)
    return { success: true, data: json.data }
  } catch (error: any) {
    console.error('Error creating schedule:', error)
    return { success: false, message: error.message }
  }
}

// Get schedule details
export const getScheduleDetails = async (scheduleId: string) => {
  try {
    const { data: schedule, error } = await supabase
      .from('schedules')
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number
        ),
        creator:users!schedules_created_by_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .eq('id', scheduleId)
      .single()

    if (error) throw error

    return { success: true, data: schedule }
  } catch (error: any) {
    console.error('Error fetching schedule details:', error)
    return { success: false, message: error.message }
  }
}

// Get all schedules (with optional filters)
export const getSchedules = async (filters?: {
  volunteer_id?: string
  start_date?: Date
  end_date?: Date
  created_by?: string
}) => {
  try {
    // Try server admin API first (handles joins with service role)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      const qs = new URLSearchParams()
      if (filters?.volunteer_id) qs.set('volunteer_id', filters.volunteer_id)
      const res = await fetch(`/api/admin/schedules${qs.toString() ? `?${qs.toString()}` : ''}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      const json = await res.json()
      if (res.ok && json?.success) {
        return { success: true, data: json.data }
      }
      console.warn('Admin schedules API failed; falling back to client query:', json?.message || res.statusText)
    } catch (e) {
      console.warn('Admin schedules API not reachable; falling back to client query')
    }

    let query = supabase
      .from('schedules')
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey(
          id,
          first_name,
          last_name,
          email,
          phone_number
        ),
        creator:users!schedules_created_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .order('start_time', { ascending: true })

    if (filters?.volunteer_id) {
      query = query.eq('volunteer_id', filters.volunteer_id)
    }

    if (filters?.created_by) {
      query = query.eq('created_by', filters.created_by)
    }

    if (filters?.start_date) {
      query = query.gte('start_time', filters.start_date.toISOString())
    }

    if (filters?.end_date) {
      query = query.lte('end_time', filters.end_date.toISOString())
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching schedules:', error.message)
    return { success: false, message: error.message, data: [] }
  }
}

// Alias for backward compatibility
export const getAllSchedules = getSchedules

// Get schedules for a volunteer
export const getVolunteerSchedules = async (volunteerId: string) => {
  try {
    console.log(`Getting schedules for volunteer ID: ${volunteerId}`)

    if (!volunteerId) {
      console.error("No volunteer ID provided to getVolunteerSchedules")
      return { success: false, message: "No volunteer ID provided", data: [] }
    }

    // Prefer server API bound to auth session
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      const res = await fetch('/api/volunteer/schedules', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      const json = await res.json()
      if (res.ok && json?.success) {
        console.log(`Retrieved ${json.data?.length || 0} schedules via API for volunteer ${volunteerId}`)
        return { success: true, data: json.data || [] }
      }
      console.warn('Volunteer schedules API failed; falling back to client query:', json?.message || res.statusText)
    } catch (e) {
      console.warn('Volunteer schedules API not reachable; falling back to client query')
    }

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        creator:users!schedules_created_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .eq('volunteer_id', volunteerId)
      .order('start_time', { ascending: true })

    if (error) {
      console.error(`Error getting schedules for volunteer ${volunteerId}:`, error)
      throw error
    }

    console.log(`Retrieved ${data?.length || 0} schedules for volunteer ${volunteerId}`)
    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error(`Failed to get schedules for volunteer ${volunteerId}:`, error);
    return { 
      success: false, 
      message: error.message || "Failed to retrieve volunteer schedules", 
      data: [] 
    };
  }
}

// Get upcoming schedules for a volunteer
export const getVolunteerUpcomingSchedules = async (volunteerId: string) => {
  try {
    const now = new Date()
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        creator:users!schedules_created_by_fkey(
          first_name,
          last_name
        )
      `)
      .eq('volunteer_id', volunteerId)
      .gte('end_time', now.toISOString())
      .order('start_time', { ascending: true })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching volunteer schedules:', error.message)
    return { success: false, message: error.message, data: [] }
  }
}

// Update schedule (admin only)
export const updateSchedule = async (
  adminId: string,
  scheduleId: string,
  updates: Partial<CreateScheduleInput>
) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    const res = await fetch('/api/admin/schedules', {
      method: 'PATCH',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ id: scheduleId, ...updates }),
    })
    const json = await res.json()
    if (!res.ok || !json?.success) throw new Error(json?.message || res.statusText)
    return { success: true, data: json.data }
  } catch (error: any) {
    console.error('Error updating schedule:', error)
    return { success: false, message: error.message }
  }
}

// Delete schedule (admin only)
export const deleteSchedule = async (adminId: string, scheduleId: string) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    const res = await fetch(`/api/admin/schedules?id=${encodeURIComponent(scheduleId)}`, {
      method: 'DELETE',
      cache: 'no-store',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    const json = await res.json()
    if (!res.ok || !json?.success) throw new Error(json?.message || res.statusText)
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting schedule:', error)
    return { success: false, message: error.message }
  }
}

// Get schedules by date range
export const getSchedulesByDateRange = async (startDate: string, endDate: string) => {
  return getSchedules({
    start_date: new Date(startDate),
    end_date: new Date(endDate)
  })
}

// Get schedules by barangay
export const getSchedulesByBarangay = async (barangay: string) => {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number
        ),
        creator:users!schedules_created_by_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .eq('barangay', barangay)
      .order('start_time', { ascending: true })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching schedules by barangay:', error)
    return { success: false, message: error.message }
  }
}

// Subscribe to real-time schedule updates
export const subscribeToSchedules = (callback: (payload: any) => void) => {
  return supabase
    .channel('schedules')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'schedules'
      },
      callback
    )
    .subscribe()
}

// Volunteer accepts or declines a schedule
export const respondToSchedule = async (scheduleId: string, isAccepted: boolean) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    const res = await fetch('/api/volunteer/schedules', {
      method: 'PATCH',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ schedule_id: scheduleId, accept: isAccepted }),
    })
    const json = await res.json()
    if (!res.ok || !json?.success) throw new Error(json?.message || res.statusText)
    return { success: true, data: json.data }
  } catch (error: any) {
    console.error('Error responding to schedule:', error)
    return { success: false, message: error.message }
  }
}

// Mark schedule as completed (admin only)
export const completeSchedule = async (
  scheduleId: string, 
  attendanceMarked: boolean, 
  notes?: string
) => {
  try {
    // First mark attendance if attendanceMarked is true
    if (attendanceMarked) {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      const attendanceRes = await fetch('/api/admin/schedules/attendance', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ schedule_id: scheduleId, present: true, notes }),
      })
      const attendanceJson = await attendanceRes.json()
      if (!attendanceRes.ok || !attendanceJson?.success) {
        console.warn('Failed to mark attendance:', attendanceJson?.message)
      }
    }

    // Then mark as completed
    const { data, error } = await supabase
      .from('schedules')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      })
      .eq('id', scheduleId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error completing schedule:', error)
    return { success: false, message: error.message }
  }
}

// Get schedule statistics for dashboard
export const getScheduleStatistics = async () => {
  try {
    const { data, error } = await supabase
      .from('schedule_statistics')
      .select('*')
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching schedule statistics:', error)
    return { success: false, message: error.message, data: null }
  }
}

// Get volunteer statistics
export const getVolunteerScheduleStats = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('status, is_accepted')
      .eq('volunteer_id', volunteerId)

    if (error) throw error

    const stats = {
      total: data.length,
      scheduled: data.filter(s => s.status === 'SCHEDULED').length,
      ongoing: data.filter(s => s.status === 'ONGOING').length,
      completed: data.filter(s => s.status === 'COMPLETED').length,
      cancelled: data.filter(s => s.status === 'CANCELLED').length,
      accepted: data.filter(s => s.is_accepted === true).length,
      declined: data.filter(s => s.is_accepted === false).length,
      pending: data.filter(s => s.is_accepted === null).length
    }

    return { success: true, data: stats }
  } catch (error: any) {
    console.error('Error fetching volunteer schedule stats:', error)
    return { success: false, message: error.message, data: null }
  }
}

