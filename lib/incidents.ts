import { supabase } from "./supabase"

// Use hyphen instead of underscore for the bucket name
const BUCKET_NAME = "incident-photos"

// Function to check if coordinates are within Talisay City boundaries
// This is a simplified version - in production, use actual GeoJSON boundaries
export const isWithinTalisayCity = (lat: number, lng: number) => {
  // Approximate bounding box for Talisay City, Negros Occidental
  const TALISAY_BOUNDS = {
    north: 10.8,
    south: 10.6,
    east: 123.0,
    west: 122.8,
  }

  return (
    lat <= TALISAY_BOUNDS.north &&
    lat >= TALISAY_BOUNDS.south &&
    lng <= TALISAY_BOUNDS.east &&
    lng >= TALISAY_BOUNDS.west
  )
}

export const getAllIncidents = async () => {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select(
        `
        *,
        reporter:users!incidents_reporter_id_fkey(
          first_name,
          last_name,
          phone_number
        ),
        assigned_to:users!incidents_assigned_to_fkey(
          first_name,
          last_name,
          phone_number
        )
      `,
      )
      .order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching incidents:", error.message)
    return { success: false, message: error.message, data: [] }
  }
}

export const getResidentIncidents = async (residentId: string) => {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select(
        `
        *,
        assigned_to:users!incidents_assigned_to_fkey(
          first_name,
          last_name,
          phone_number
        )
      `,
      )
      .eq("reporter_id", residentId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching resident incidents:", error.message)
    return { success: false, message: error.message, data: [] }
  }
}

export const getVolunteerIncidents = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select(
        `
        *,
        reporter:users!incidents_reporter_id_fkey(
          first_name,
          last_name,
          phone_number
        )
      `,
      )
      .eq("assigned_to", volunteerId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching volunteer incidents:", error.message)
    return { success: false, message: error.message, data: [] }
  }
}

export const createIncident = async (
  reporterId: string,
  incidentType: string,
  description: string,
  locationLat: number,
  locationLng: number,
  address: string,
  barangay: string,
  photoFile: File | null,
  priority = 3,
) => {
  try {
    // Validate location is within Talisay City
    if (!isWithinTalisayCity(locationLat, locationLng)) {
      return {
        success: false,
        message: "Location is outside Talisay City boundaries.",
      }
    }

    let photoUrl = null

    // Upload photo if provided
    if (photoFile) {
      const fileExt = photoFile.name.split(".").pop()
      const fileName = `${reporterId}-${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, photoFile)

      if (uploadError) throw uploadError

      if (uploadData) {
        // Get public URL
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)

        photoUrl = urlData.publicUrl
      }
    }

    // Create incident record
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        reporter_id: reporterId,
        incident_type: incidentType.toUpperCase(),
        description: description.toUpperCase(),
        location_lat: locationLat,
        location_lng: locationLng,
        address: address.toUpperCase(),
        barangay: barangay.toUpperCase(),
        city: "TALISAY CITY",
        province: "NEGROS OCCIDENTAL",
        status: "PENDING",
        priority,
        photo_url: photoUrl,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export const assignIncident = async (incidentId: string, volunteerId: string, adminId: string) => {
  try {
    // Check if admin
    const { data: adminData, error: adminError } = await supabase
      .from("users")
      .select("role")
      .eq("id", adminId)
      .single()

    if (adminError) throw adminError

    if (adminData.role !== "admin") {
      throw new Error("Only admins can assign incidents")
    }

    // Update incident
    const { data, error } = await supabase
      .from("incidents")
      .update({
        assigned_to: volunteerId,
        assigned_at: new Date().toISOString(),
        status: "ASSIGNED",
      })
      .eq("id", incidentId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export const updateIncidentStatus = async (
  incidentId: string,
  newStatus: "RESPONDING" | "RESOLVED",
  resolutionNotes?: string,
) => {
  try {
    const updates: any = {
      status: newStatus,
    }

    if (newStatus === "RESOLVED") {
      updates.resolved_at = new Date().toISOString()
      if (resolutionNotes) {
        updates.resolution_notes = resolutionNotes.toUpperCase()
      }
    }

    const { data, error } = await supabase.from("incidents").update(updates).eq("id", incidentId).select().single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export const getIncidentUpdates = async (incidentId: string) => {
  try {
    const { data, error } = await supabase
      .from("incident_updates")
      .select(`
        *,
        updated_by:users(
          first_name,
          last_name,
          role
        )
      `)
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: true })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

export const getIncidentById = async (incidentId: string) => {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey(
          id,
          first_name,
          last_name,
          phone_number,
          email,
          barangay
        ),
        assigned_to:users!incidents_assigned_to_fkey(
          id,
          first_name,
          last_name,
          phone_number,
          email
        )
      `)
      .eq("id", incidentId)
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Subscribe to real-time incident updates (for admins)
export const subscribeToIncidents = (callback: (payload: any) => void) => {
  return supabase
    .channel("incidents-channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, callback)
    .subscribe()
}

// Subscribe to real-time incident updates for a specific volunteer
export const subscribeToVolunteerIncidents = (volunteerId: string, callback: (payload: any) => void) => {
  return supabase
    .channel(`volunteer-incidents-${volunteerId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "incidents",
        filter: `assigned_to=eq.${volunteerId}`,
      },
      callback,
    )
    .subscribe()
}

// Subscribe to real-time incident updates for a specific resident
export const subscribeToResidentIncidents = (residentId: string, callback: (payload: any) => void) => {
  return supabase
    .channel(`resident-incidents-${residentId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "incidents",
        filter: `reporter_id=eq.${residentId}`,
      },
      callback,
    )
    .subscribe()
}
