import { supabase } from "./supabase"

export interface ActivitySchedule {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  barangay: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Get all activity schedules
export const getActivitySchedules = async () => {
  try {
    const { data, error } = await supabase
      .from('activity_schedules')
      .select(`
        *,
        creator:users!activity_schedules_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .order('start_time', { ascending: true })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching activity schedules:', error)
    return { success: false, message: error.message }
  }
}

// Get upcoming activity schedules
export const getUpcomingActivitySchedules = async () => {
  try {
    const { data, error } = await supabase
      .from('activity_schedules')
      .select(`
        *,
        creator:users!activity_schedules_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching upcoming activity schedules:', error)
    return { success: false, message: error.message }
  }
}

// Create activity schedule (admin only)
export const createActivitySchedule = async (
  adminId: string,
  data: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    location?: string;
    barangay?: string;
  }
) => {
  try {
    // Check if admin
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single()

    if (adminError) throw adminError
    if (adminData.role !== 'admin') {
      throw new Error('Only admins can create activity schedules')
    }

    const { data: schedule, error } = await supabase
      .from('activity_schedules')
      .insert({
        created_by: adminId,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data: schedule }
  } catch (error: any) {
    console.error('Error creating activity schedule:', error)
    return { success: false, message: error.message }
  }
}

// Update activity schedule (admin only)
export const updateActivitySchedule = async (
  adminId: string,
  scheduleId: string,
  updates: {
    title?: string;
    description?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    barangay?: string;
  }
) => {
  try {
    // Check if admin
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single()

    if (adminError) throw adminError
    if (adminData.role !== 'admin') {
      throw new Error('Only admins can update activity schedules')
    }

    const { data: schedule, error } = await supabase
      .from('activity_schedules')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data: schedule }
  } catch (error: any) {
    console.error('Error updating activity schedule:', error)
    return { success: false, message: error.message }
  }
}

// Delete activity schedule (admin only)
export const deleteActivitySchedule = async (adminId: string, scheduleId: string) => {
  try {
    // Check if admin
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single()

    if (adminError) throw adminError
    if (adminData.role !== 'admin') {
      throw new Error('Only admins can delete activity schedules')
    }

    const { error } = await supabase
      .from('activity_schedules')
      .delete()
      .eq('id', scheduleId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting activity schedule:', error)
    return { success: false, message: error.message }
  }
}

// Get activity schedule by ID
export const getActivityScheduleById = async (scheduleId: string) => {
  try {
    const { data, error } = await supabase
      .from('activity_schedules')
      .select(`
        *,
        creator:users!activity_schedules_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .eq('id', scheduleId)
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching activity schedule:', error)
    return { success: false, message: error.message }
  }
}

// Get activity schedules for a specific barangay
export const getActivitySchedulesByBarangay = async (barangay: string) => {
  try {
    const { data, error } = await supabase
      .from('activity_schedules')
      .select(`
        *,
        creator:users!activity_schedules_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .eq('barangay', barangay)
      .order('start_time', { ascending: true })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching activity schedules for barangay:', error)
    return { success: false, message: error.message }
  }
} 