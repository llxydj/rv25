import { supabase } from "./supabase"

// Get incident statistics by barangay
export const getIncidentsByBarangay = async (startDate?: string, endDate?: string) => {
  try {
    // Fetch barangay and created_at; aggregate in JS to avoid relying on group()
    let query = supabase.from("incidents").select("barangay, created_at")

    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data, error } = await query

    if (error) throw error

    const counts: Record<string, number> = {}
    ;(data as Array<{ barangay: string | null }> | null || []).forEach((row) => {
      const key = row.barangay || "UNKNOWN"
      counts[key] = (counts[key] || 0) + 1
    })

    const result = Object.entries(counts).map(([barangay, count]) => ({ barangay, count }))

    return { success: true, data: result }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

// Get incident statistics by type
export const getIncidentsByType = async (startDate?: string, endDate?: string) => {
  try {
    // Fetch incident_type and created_at; aggregate in JS
    let query = supabase.from("incidents").select("incident_type, created_at")

    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data, error } = await query

    if (error) throw error

    const counts: Record<string, number> = {}
    ;(data as Array<{ incident_type: string | null }> | null || []).forEach((row) => {
      const key = row.incident_type || "UNKNOWN"
      counts[key] = (counts[key] || 0) + 1
    })

    const result = Object.entries(counts).map(([incident_type, count]) => ({ incident_type, count }))

    return { success: true, data: result }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

// Get incident statistics by status
export const getIncidentsByStatus = async (startDate?: string, endDate?: string) => {
  try {
    // Fetch status and created_at; aggregate in JS
    let query = supabase.from("incidents").select("status, created_at")

    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data, error } = await query

    if (error) throw error

    const counts: Record<string, number> = {}
    ;(data as Array<{ status: string | null }> | null || []).forEach((row) => {
      const key = row.status || "UNKNOWN"
      counts[key] = (counts[key] || 0) + 1
    })

    const result = Object.entries(counts).map(([status, count]) => ({ status, count }))

    return { success: true, data: result }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

// Get volunteer performance statistics
export const getVolunteerPerformance = async () => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        first_name,
        last_name,
        volunteer_profiles(
          total_incidents_resolved,
          status
        )
      `)
      .eq("role", "volunteer")

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

// Get average response time
export const getAverageResponseTime = async (startDate?: string, endDate?: string) => {
  try {
    let query = supabase.rpc("calculate_average_response_time")

    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message, data: null }
  }
}

// Define reporter and assigned_to types
type ReporterItem = {
  first_name: any;
  last_name: any;
  phone_number: any;
};

type AssignedToItem = {
  first_name: any;
  last_name: any;
};

// Define incident type with the correct shape from Supabase
interface IncidentFromDB {
  id: any;
  created_at: any;
  incident_type: any;
  description: any;
  location_lat: any;
  location_lng: any;
  address: any;
  barangay: any;
  status: any;
  priority: any;
  assigned_at: any;
  resolved_at: any;
  reporter: ReporterItem[];
  assigned_to: AssignedToItem[];
}

// Export incidents to CSV
export const exportIncidentsToCSV = async (startDate?: string, endDate?: string) => {
  try {
    let query = supabase.from("incidents").select(`
        id,
        created_at,
        incident_type,
        description,
        location_lat,
        location_lng,
        address,
        barangay,
        status,
        priority,
        assigned_at,
        resolved_at,
        reporter:users!incidents_reporter_id_fkey(
          first_name,
          last_name,
          phone_number
        ),
        assigned_to:users!incidents_assigned_to_fkey(
          first_name,
          last_name
        )
      `)

    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data, error } = await query

    if (error) throw error

    // Format data for CSV
    const csvData = data.map((incident: IncidentFromDB) => {
      // Access the reporter and assigned_to arrays (which might be empty)
      const reporterArray = incident.reporter || [];
      const assignedToArray = incident.assigned_to || [];
      
      // Get the first item if exists
      const reporter = reporterArray.length > 0 ? reporterArray[0] : null;
      const assignedTo = assignedToArray.length > 0 ? assignedToArray[0] : null;

      return {
        ID: incident.id,
        Date: new Date(incident.created_at).toLocaleString(),
        Type: incident.incident_type,
        Description: incident.description,
        Location: `${incident.location_lat},${incident.location_lng}`,
        Address: incident.address,
        Barangay: incident.barangay,
        Status: incident.status,
        Priority: incident.priority,
        Reporter: reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unknown",
        ReporterPhone: reporter ? reporter.phone_number : "N/A",
        AssignedTo: assignedTo
          ? `${assignedTo.first_name} ${assignedTo.last_name}`
          : "Unassigned",
        AssignedAt: incident.assigned_at ? new Date(incident.assigned_at).toLocaleString() : "N/A",
        ResolvedAt: incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : "N/A",
      }
    })

    return { success: true, data: csvData }
  } catch (error: any) {
    return { success: false, message: error.message, data: [] }
  }
}

// New functions for volunteer reports

// Get all reports for a volunteer
export const getVolunteerReports = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select(`
        *,
        incident:incidents(incident_type, barangay)
      `)
      .eq("created_by", volunteerId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching volunteer reports:", error.message)
    return { success: false, message: error.message, data: [] }
  }
}

// Get active incidents for a volunteer (for reporting)
export const getVolunteerActiveIncidents = async (volunteerId: string) => {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select("id, incident_type, barangay, status")
      .in("status", ["ASSIGNED", "RESPONDING"])
      .eq("assigned_to", volunteerId)
      .order("created_at", { ascending: false })
      
    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching volunteer active incidents:", error.message)
    return { success: false, message: error.message, data: [] }
  }
}

// Create a new report
export const createReport = async (
  title: string,
  reportType: string,
  description: string,
  createdBy: string,
  incidentId?: string | null
) => {
  try {
    const { data, error } = await supabase
      .from("reports")
      .insert({
        title: title.toUpperCase(),
        report_type: reportType,
        incident_id: incidentId || null,
        description: description.toUpperCase(),
        created_by: createdBy,
        status: "SUBMITTED"
      })
      .select()
      .single()
      
    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error creating report:", error.message)
    return { success: false, message: error.message }
  }
}

// Get a specific report by ID
export const getReportById = async (reportId: string) => {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select(`
        *,
        incident:incidents(
          id,
          incident_type, 
          description,
          barangay,
          status,
          created_at
        ),
        created_by_user:users(
          first_name,
          last_name
        )
      `)
      .eq("id", reportId)
      .single()
      
    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching report:", error.message)
    return { success: false, message: error.message }
  }
}

// Update report status
export const updateReportStatus = async (reportId: string, status: string, reviewNotes?: string) => {
  try {
    const updates: any = { status }
    
    if (reviewNotes) {
      updates.review_notes = reviewNotes
    }
    
    const { data, error } = await supabase
      .from("reports")
      .update(updates)
      .eq("id", reportId)
      .select()
      .single()
      
    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error updating report status:", error.message)
    return { success: false, message: error.message }
  }
}
