import { supabase } from "./supabase"
import { VolunteerProfile, VolunteerStatus, UserWithVolunteerProfile, VolunteerProfileUpdate } from "@/types/volunteer"

// Get all volunteers
export const getAllVolunteers = async () => {
  try {
    // Prefer server API to ensure admin-bound auth and consistent RLS access
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    const res = await fetch('/api/admin/volunteers', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    const json = await res.json()
    if (res.ok && json?.success) {
      return { success: true, data: json.data }
    }
    // Fall through to client-side join if API not available
    console.warn('Falling back to client join for volunteers:', json?.message || res.statusText)
  } catch (e) {
    console.warn('Admin volunteers API not reachable, falling back to client join')
  }

  // Fallback: client-side join (older behavior)
  try {
    const { data: volunteerUsers, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'volunteer')
    if (usersError) throw usersError
    if (!volunteerUsers?.length) return { success: true, data: [] }
    const volunteerIds = volunteerUsers.map(u => u.id)
    const { data: profiles, error: profilesError } = await supabase
      .from('volunteer_profiles')
      .select('*')
      .in('volunteer_user_id', volunteerIds)
    if (profilesError) throw profilesError

    const transformedData = volunteerUsers.map(user => {
      const profile = profiles?.find(p => p.volunteer_user_id === user.id)
      return {
        ...user,
        role: 'volunteer' as const,
        volunteer_profiles: profile ? {
          ...profile,
          is_available: (profile as any).is_available === true || (profile as any).is_available === 'true',
          skills: Array.isArray((profile as any).skills) ? (profile as any).skills : [],
          availability: Array.isArray((profile as any).availability) ? (profile as any).availability : [],
          assigned_barangays: Array.isArray((profile as any).assigned_barangays) ? (profile as any).assigned_barangays : [],
        } : null,
      }
    })
    return { success: true, data: transformedData }
  } catch (error: any) {
    console.error('Error in getAllVolunteers (fallback):', error)
    return { success: false, message: error.message, data: [] }
  }
}

export const getVolunteerPerformance = async () => {
  try {
    const { data, error } = await supabase.rpc('volunteer_performance_kpis')
    if (error) throw error
    return { success: true, data }
  } catch (e: any) {
    return { success: false, message: e?.message || 'Failed to load volunteer performance' }
  }
}

// Get inactive volunteers (inactive for 30+ days)
export const getInactiveVolunteers = async () => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone_number,
        barangay,
        last_active,
        volunteer_profiles!volunteer_profiles_volunteer_user_id_fkey(
          status,
          skills,
          assigned_barangays,
          total_incidents_resolved
        )
      `)
      .eq("role", "volunteer")
      .lt("last_active", thirtyDaysAgo.toISOString())

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

// Update volunteer status
export const updateVolunteerStatus = async (
  volunteerId: string,
  status: VolunteerStatus,
  adminId: string,
) => {
  try {
    // Check if admin
    const { data: adminData, error: adminError } = await supabase
      .from("users")
      .select("role")
      .eq("id", adminId)
      .single()

    if (adminError) throw adminError

    if (adminData.role !== "admin") {
      throw new Error("Only admins can update volunteer status")
    }

    // First check if the volunteer already has a profile record
    const { data: existingProfile, error: profileError } = await supabase
      .from("volunteer_profiles")
      .select("*")
      .eq("volunteer_user_id", volunteerId)
      .maybeSingle()  // Use maybeSingle instead of single to avoid throwing if not found

    const now = new Date().toISOString()

    if (!existingProfile) {
      // Create new volunteer profile
      try {
        const { data: newProfile, error: createError } = await supabase
          .from("volunteer_profiles")
          .insert({
            volunteer_user_id: volunteerId,
            admin_user_id: adminId,
            status,
            skills: [],
            availability: [],
            assigned_barangays: [],
            total_incidents_resolved: 0,
            is_available: false,
            created_at: now,
            updated_at: now,
            last_status_change: now,
            last_status_changed_by: adminId
          })
          .select()
          .single()

        if (createError) {
          // If this is a duplicate key error, the profile might have been created elsewhere
          if (createError.code === '23505' || createError.message.includes('duplicate key')) {
            // The profile got created by another process, try to update it instead
            const { data: updatedProfile, error: updateError } = await supabase
              .from("volunteer_profiles")
              .update({ 
                status,
                admin_user_id: adminId,
                updated_at: now,
                last_status_change: now,
                last_status_changed_by: adminId
              })
              .eq("volunteer_user_id", volunteerId)
              .select()
              .single()
              
            if (updateError) throw updateError
            return { success: true, data: updatedProfile }
          } else {
            throw createError
          }
        }
        
        return { success: true, data: newProfile }
      } catch (err: any) {
        console.error("Error creating volunteer profile:", err.message)
        throw err
      }
    } else {
      // Update existing volunteer profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from("volunteer_profiles")
        .update({ 
          status,
          updated_at: now,
          last_status_change: now,
          last_status_changed_by: adminId
        })
        .eq("volunteer_user_id", volunteerId)
        .select()
        .single()

      if (updateError) throw updateError
      return { success: true, data: updatedProfile }
    }
  } catch (error: any) {
    console.error("Error updating volunteer status:", error.message)
    return { success: false, message: error.message }
  }
}

// Get volunteer profile
export const getVolunteerProfile = async (userId: string): Promise<{ success: boolean; data?: UserWithVolunteerProfile; message?: string }> => {
  try {
    // First check if user exists and get their data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("role", "volunteer")
      .single()

    if (userError) throw userError
    if (!userData) throw new Error("Volunteer not found")

    // Then get volunteer profile
    const { data: profileData, error: profileError } = await supabase
      .from("volunteer_profiles")
      .select("*")
      .eq("volunteer_user_id", userId)
      .single()

    let volunteerProfile = profileData

    // Handle case where profile doesn't exist
    if (profileError) {
      // Only attempt to create if it truly doesn't exist
      if (profileError.code === 'PGRST116') {
        try {
          const now = new Date().toISOString()
          const { data: newProfile, error: createError } = await supabase
            .from('volunteer_profiles')
            .insert({
              volunteer_user_id: userId,
              admin_user_id: null, // Will be set by admin later when approving
              status: 'INACTIVE', // Start as inactive until admin approves
              is_available: false,
              skills: [],
              availability: [],
              assigned_barangays: [],
              total_incidents_resolved: 0,
              created_at: now,
              updated_at: now,
              last_status_change: now,
              last_status_changed_by: userId // Set the volunteer as the creator initially
            })
            .select()
            .single()

          if (createError) {
            // If there's a duplicate key error, it means another process created the profile
            // Try to fetch it one more time
            if (createError.code === '23505' || createError.message.includes('duplicate key')) {
              console.log('Profile creation race condition detected, retrying fetch...');
              const { data: retryProfileData, error: retryError } = await supabase
                .from("volunteer_profiles")
                .select("*")
                .eq("volunteer_user_id", userId)
                .single()
              
              if (retryError) {
                throw retryError;
              }
              volunteerProfile = retryProfileData;
            } else if (createError.code === 'PGRST204') {
              // If we get an RLS error, return a more helpful message
              return { 
                success: false,
                message: "Your profile needs to be activated by an admin. Please contact the administrator."
              }
            } else {
              throw createError;
            }
          } else {
            volunteerProfile = newProfile;
          }
        } catch (insertError: any) {
          console.error("Error in profile creation:", insertError);
          if (insertError.message.includes('duplicate key')) {
            // Final fallback - try one more fetch if the insert failed due to race condition
            const { data: finalRetryData, error: finalRetryError } = await supabase
              .from("volunteer_profiles")
              .select("*")
              .eq("volunteer_user_id", userId) 
              .single()
              
            if (finalRetryError) {
              throw finalRetryError;
            }
            volunteerProfile = finalRetryData;
          } else {
            throw insertError;
          }
        }
      } else {
        throw profileError;
      }
    }

    // Return combined user and profile data
    return {
      success: true,
      data: {
        ...userData,
        role: 'volunteer',
        volunteer_profiles: volunteerProfile
      }
    }
  } catch (error: any) {
    console.error("Error fetching volunteer profile:", error?.message || error);
    return { 
      success: false, 
      message: error?.message || "An unexpected error occurred while fetching volunteer profile"
    }
  }
}

// Update volunteer profile
export const updateVolunteerProfile = async (
  userId: string,
  updates: VolunteerProfileUpdate
) => {
  try {
    const now = new Date().toISOString()

    // Update volunteer profile
    const { data, error } = await supabase
      .from('volunteer_profiles')
      .update({
        ...updates,
        updated_at: now
      })
      .eq('volunteer_user_id', userId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error updating volunteer profile:", error.message)
    return { success: false, message: error.message }
  }
}

// Update volunteer personal information (users table fields)
export const updateVolunteerPersonalInfo = async (
  userId: string,
  updates: {
    phone_number?: string
    address?: string
    barangay?: string
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
    emergency_contact_name?: string
    emergency_contact_phone?: string
    emergency_contact_relationship?: string
  }
) => {
  try {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: now
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error updating volunteer personal info:", error.message)
    return { success: false, message: error.message }
  }
}

// Function to create a new volunteer
export const createVolunteer = async ({
  email,
  password,
  firstName,
  lastName,
  phone,
  address,
  barangay,
  adminId,
}: {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  barangay?: string
  adminId: string
}) => {
  try {
    // Call the server-side API route
    const response = await fetch('/api/admin/volunteers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        firstName,
        lastName,
        phone,
        address,
        barangay,
        adminId,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Failed to create volunteer account')
    }

    return result
  } catch (error: any) {
    console.error("Error creating volunteer:", error.message)
    return { success: false, message: error.message }
  }
}

// Function to get a single volunteer by ID
export const getVolunteerById = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(`
        *,
        volunteer_profiles!volunteer_profiles_volunteer_user_id_fkey (
          status,
          skills,
          availability,
          assigned_barangays,
          total_incidents_resolved,
          notes,
          created_at,
          updated_at,
          last_status_change,
          last_status_changed_by,
          admin_user_id
        )
      `)
      .eq("id", volunteerId)
      .eq("role", "volunteer")
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching volunteer:", error.message)
    return { success: false, message: error.message }
  }
}

// Update volunteer activity status
export const updateVolunteerActivityStatus = async (volunteerId: string, isActive: boolean) => {
  try {
    // Update last_active in volunteer_profiles table
    const { data, error } = await supabase
      .from('volunteer_profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('volunteer_user_id', volunteerId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error updating volunteer status:", error.message)
    return { success: false, message: error.message }
  }
}

// Update volunteer's last active timestamp
export const updateVolunteerLastActive = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from('volunteer_profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('volunteer_user_id', volunteerId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error updating volunteer last active:', error.message)
    return { success: false, message: error.message }
  }
}

// Update volunteer availability
export const updateVolunteerAvailability = async (
  userId: string,
  isAvailable: boolean
) => {
  try {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('volunteer_profiles')
      .update({
        is_available: isAvailable,
        updated_at: now
      })
      .eq('volunteer_user_id', userId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error updating volunteer availability:", error.message)
    return { success: false, message: error.message }
  }
}

// Get volunteer information
export const getVolunteerInformation = async (volunteerId: string) => {
  try {
    if (!volunteerId) {
      throw new Error("Volunteer ID is required")
    }

    const { data, error } = await supabase
      .from('volunteer_information')
      .select('*')
      .eq('user_id', volunteerId)
      .maybeSingle()

    if (error) {
      console.error('Database error fetching volunteer information:', error)
      throw error
    }

    return { 
      success: true, 
      data,
      message: data ? "Volunteer information retrieved successfully" : "No information found for this volunteer"
    }
  } catch (error: any) {
    const errorMessage = error?.message || "An unexpected error occurred"
    const errorDetails = error?.details || error?.hint || null
    
    console.error('Error fetching volunteer information:', {
      message: errorMessage,
      details: errorDetails,
      error
    })

    return { 
      success: false, 
      message: errorMessage,
      details: errorDetails,
      error 
    }
  }
}

// Update volunteer information with improved error handling
export const updateVolunteerInformation = async (
  volunteerId: string,
  info: {
    bio?: string
    skills?: string
    documents?: string // JSON string
  }
) => {
  try {
    if (!volunteerId) {
      throw new Error("Volunteer ID is required")
    }

    // Validate input
    if (info.documents) {
      try {
        JSON.parse(info.documents)
      } catch (e) {
        throw new Error("Invalid JSON format in documents field")
      }
    }

    const { error } = await supabase
      .from('volunteer_information')
      .upsert({
        user_id: volunteerId,
        ...info,
        last_activity: new Date().toISOString()
      })

    if (error) {
      console.error('Database error updating volunteer information:', error)
      throw error
    }

    return { 
      success: true,
      message: "Volunteer information updated successfully"
    }
  } catch (error: any) {
    const errorMessage = error?.message || "An unexpected error occurred"
    const errorDetails = error?.details || error?.hint || null
    
    console.error('Error updating volunteer information:', {
      message: errorMessage,
      details: errorDetails,
      error
    })

    return { 
      success: false, 
      message: errorMessage,
      details: errorDetails,
      error 
    }
  }
}

// Get volunteer activities
export const getVolunteerActivities = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from('volunteeractivities')
      .select(`
        *,
        incidents (
          id,
          incident_type,
          status,
          created_at
        )
      `)
      .eq('volunteer_user_id', volunteerId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching volunteer activities:', error)
    return { success: false, message: error.message }
  }
}

// Get scheduled activities
export const getScheduledActivities = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from('scheduledactivities')
      .select(`
        *,
        creator:users!scheduledactivities_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .eq('volunteer_user_id', volunteerId)
      .order('date', { ascending: true })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error('Error fetching scheduled activities:', error)
    return { success: false, message: error.message }
  }
}

// Update scheduled activity response
export const updateScheduledActivityResponse = async (scheduleId: string, isAccepted: boolean) => {
  try {
    const { error } = await supabase
      .from('scheduledactivities')
      .update({
        is_accepted: isAccepted,
        response_at: new Date().toISOString()
      })
      .eq('schedule_id', scheduleId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating activity response:', error)
    return { success: false, message: error.message }
  }
}

// Create scheduled activity (admin only)
export const createScheduledActivity = async (adminId: string, data: {
  volunteer_user_id: string
  title: string
  description?: string
  date: string
  time?: string
  location?: string
}) => {
  try {
    const { error } = await supabase
      .from('scheduledactivities')
      .insert({
        created_by: adminId,
        volunteer_user_id: data.volunteer_user_id,
        title: data.title,
        description: data.description,
        date: data.date,
        time: data.time,
        location: data.location,
        created_at: new Date().toISOString()
      })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error creating scheduled activity:', error)
    return { success: false, message: error.message }
  }
}

// Get volunteer metrics (admin only)
export const getVolunteerMetrics = async (adminId: string) => {
  try {
    // Check if admin
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single()

    if (adminError) throw adminError
    if (adminData.role !== 'admin') {
      throw new Error('Only admins can view volunteer metrics')
    }

    // Get various metrics
    const { data: activeVolunteers, error: activeError } = await supabase
      .from('volunteer_profiles')
      .select('volunteer_user_id')
      .eq('is_available', true)

    if (activeError) throw activeError

    const { data: totalActivities, error: activitiesError } = await supabase
      .from('volunteeractivities')
      .select('volunteer_user_id, participated, resolved_at')

    if (activitiesError) throw activitiesError

    // Calculate metrics
    const metrics = {
      active_volunteers: activeVolunteers.length,
      total_activities: totalActivities.length,
      completed_activities: totalActivities.filter(a => a.resolved_at !== null).length,
      participating_activities: totalActivities.filter(a => a.participated && !a.resolved_at).length
    }

    return { success: true, data: metrics }
  } catch (error: any) {
    console.error('Error fetching volunteer metrics:', error)
    return { success: false, message: error.message }
  }
}
