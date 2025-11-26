import { supabase } from "./supabase"

export interface VolunteerSchedule {
  id: string;
  volunteer_id: string;
  day_of_week: string;
  available_start: string;
  available_end: string;
  created_at: string;
  updated_at: string;
}

// Get volunteer's availability schedule
export const getVolunteerSchedule = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from('volunteer_schedules')
      .select('*')
      .eq('volunteer_id', volunteerId)
      .order('day_of_week', { ascending: true })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching volunteer schedule:', error)
    return { success: false, message: error.message }
  }
}

// Update volunteer's availability schedule
export const updateVolunteerSchedule = async (
  volunteerId: string,
  schedules: {
    day_of_week: string;
    available_start: string;
    available_end: string;
  }[]
) => {
  try {
    // Delete existing schedules
    const { error: deleteError } = await supabase
      .from('volunteer_schedules')
      .delete()
      .eq('volunteer_id', volunteerId)

    if (deleteError) throw deleteError

    // Insert new schedules
    const { data, error: insertError } = await supabase
      .from('volunteer_schedules')
      .insert(
        schedules.map(schedule => ({
          volunteer_id: volunteerId,
          ...schedule,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      )
      .select()

    if (insertError) throw insertError

    return { success: true, data }
  } catch (error: any) {
    console.error('Error updating volunteer schedule:', error)
    return { success: false, message: error.message }
  }
}

// Get volunteer's availability for a specific day
export const getVolunteerAvailabilityForDay = async (volunteerId: string, dayOfWeek: string) => {
  try {
    const { data, error } = await supabase
      .from('volunteer_schedules')
      .select('*')
      .eq('volunteer_id', volunteerId)
      .eq('day_of_week', dayOfWeek)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 is "not found" error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching volunteer availability:', error)
    return { success: false, message: error.message }
  }
}

// Check if volunteer is available at a specific time
export const checkVolunteerAvailability = async (
  volunteerId: string,
  date: Date,
  startTime: string,
  endTime: string
) => {
  try {
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
    
    const { data, error } = await supabase
      .from('volunteer_schedules')
      .select('*')
      .eq('volunteer_id', volunteerId)
      .eq('day_of_week', dayOfWeek)
      .lte('available_start', startTime)
      .gte('available_end', endTime)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return { success: true, isAvailable: !!data }
  } catch (error: any) {
    console.error('Error checking volunteer availability:', error)
    return { success: false, message: error.message }
  }
} 