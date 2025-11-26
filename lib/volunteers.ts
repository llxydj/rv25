// lib/volunteer.ts

import { supabase } from "./supabase"

// Get all volunteers
export const getAllVolunteers = async () => {
  try {
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
        volunteer_profiles(
          status,
          skills,
          assigned_barangays,
          total_incidents_resolved
        )
      `)
      .eq("role", "volunteer")

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
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
        volunteer_profiles(
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
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
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

    // Update volunteer profile
    const { data, error } = await supabase
      .from("volunteer_profiles")
      .update({ status })
      .eq("id", volunteerId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Get volunteer profile
export const getVolunteerProfile = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone_number,
        address,
        barangay,
        last_active,
        volunteer_profiles(
          status,
          skills,
          availability,
          assigned_barangays,
          total_incidents_resolved,
          notes
        )
      `)
      .eq("id", volunteerId)
      .eq("role", "volunteer")
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Update volunteer profile
export const updateVolunteerProfile = async (
  volunteerId: string,
  updates: {
    firstName?: string
    lastName?: string
    phoneNumber?: string
    address?: string
    barangay?: string
    skills?: string[]
    assignedBarangays?: string[]
    availability?: string[]
    notes?: string
  },
) => {
  try {
    // Start a transaction
    const { error: transactionError } = await supabase.rpc("begin_transaction")
    if (transactionError) throw transactionError

    // Update user table
    if (updates.firstName || updates.lastName || updates.phoneNumber || updates.address || updates.barangay) {
      const userUpdates: any = {}

      if (updates.firstName) userUpdates.first_name = updates.firstName.toUpperCase()
      if (updates.lastName) userUpdates.last_name = updates.lastName.toUpperCase()
      if (updates.phoneNumber) userUpdates.phone_number = updates.phoneNumber
      if (updates.address) userUpdates.address = updates.address.toUpperCase()
      if (updates.barangay) userUpdates.barangay = updates.barangay.toUpperCase()

      const { error: userError } = await supabase.from("users").update(userUpdates).eq("id", volunteerId)

      if (userError) {
        await supabase.rpc("rollback_transaction")
        throw userError
      }
    }

    // Update volunteer_profiles table
    if (updates.skills || updates.assignedBarangays || updates.availability || updates.notes) {
      const profileUpdates: any = {}

      if (updates.skills) profileUpdates.skills = updates.skills
      if (updates.assignedBarangays) profileUpdates.assigned_barangays = updates.assignedBarangays
      if (updates.availability) profileUpdates.availability = updates.availability
      if (updates.notes) profileUpdates.notes = updates.notes.toUpperCase()

      const { error: profileError } = await supabase
        .from("volunteer_profiles")
        .update(profileUpdates)
        .eq("id", volunteerId)

      if (profileError) {
        await supabase.rpc("rollback_transaction")
        throw profileError
      }
    }

    // Commit transaction
    const { error: commitError } = await supabase.rpc("commit_transaction")
    if (commitError) throw commitError

    return { success: true, message: "Profile updated successfully" }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}
