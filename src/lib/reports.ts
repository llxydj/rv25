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
      const raw = row.barangay && typeof row.barangay === "string" ? row.barangay.trim() : null
      const key = raw && raw.length > 0 ? raw : "UNKNOWN"
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

// Export incidents to CSV - ENHANCED with all fields
export const exportIncidentsToCSV = async (startDate?: string, endDate?: string) => {
  try {
    let query = supabase.from("incidents").select(`
        id,
        created_at,
        updated_at,
        incident_type,
        description,
        location_lat,
        location_lng,
        address,
        barangay,
        city,
        province,
        status,
        priority,
        severity,
        assigned_at,
        resolved_at,
        resolution_notes,
        photo_url,
        photo_urls,
        reporter_id,
        assigned_to,
        reporter:users!incidents_reporter_id_fkey(
          id,
          first_name,
          last_name,
          email,
          phone_number
        ),
        assigned_to_user:users!incidents_assigned_to_fkey(
          id,
          first_name,
          last_name,
          email,
          phone_number
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

    // Format data for CSV with complete information
    const csvData = data.map((incident: any) => {
      // Access the reporter and assigned_to arrays (which might be empty)
      const reporterArray = incident.reporter || [];
      const assignedToArray = incident.assigned_to_user || [];
      
      // Get the first item if exists
      const reporter = reporterArray.length > 0 ? reporterArray[0] : null;
      const assignedTo = assignedToArray.length > 0 ? assignedToArray[0] : null;

      // Calculate response time (time from creation to assignment)
      const responseTimeMinutes = incident.assigned_at && incident.created_at
        ? Math.round((new Date(incident.assigned_at).getTime() - new Date(incident.created_at).getTime()) / (1000 * 60))
        : null;

      // Calculate resolution time (time from creation to resolution)
      const resolutionTimeMinutes = incident.resolved_at && incident.created_at
        ? Math.round((new Date(incident.resolved_at).getTime() - new Date(incident.created_at).getTime()) / (1000 * 60))
        : null;

      // Calculate assignment to resolution time
      const assignmentToResolutionMinutes = incident.resolved_at && incident.assigned_at
        ? Math.round((new Date(incident.resolved_at).getTime() - new Date(incident.assigned_at).getTime()) / (1000 * 60))
        : null;

      // Format time durations
      const formatDuration = (minutes: number | null) => {
        if (minutes === null) return "N/A";
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      };

      return {
        "Incident ID": incident.id,
        "Created At": new Date(incident.created_at).toLocaleString(),
        "Updated At": incident.updated_at ? new Date(incident.updated_at).toLocaleString() : "N/A",
        "Type": incident.incident_type,
        "Description": incident.description || "",
        "Latitude": incident.location_lat,
        "Longitude": incident.location_lng,
        "Address": incident.address || "",
        "Barangay": incident.barangay,
        "City": incident.city || "TALISAY CITY",
        "Province": incident.province || "NEGROS OCCIDENTAL",
        "Status": incident.status,
        "Priority": incident.priority,
        "Severity": incident.severity || "MODERATE",
        "Reporter ID": incident.reporter_id || "N/A",
        "Reporter Name": reporter ? `${reporter.first_name || ""} ${reporter.last_name || ""}`.trim() : "Unknown",
        "Reporter Email": reporter?.email || "N/A",
        "Reporter Phone": reporter?.phone_number || "N/A",
        "Assigned To ID": incident.assigned_to || "N/A",
        "Assigned To Name": assignedTo ? `${assignedTo.first_name || ""} ${assignedTo.last_name || ""}`.trim() : "Unassigned",
        "Assigned To Email": assignedTo?.email || "N/A",
        "Assigned To Phone": assignedTo?.phone_number || "N/A",
        "Assigned At": incident.assigned_at ? new Date(incident.assigned_at).toLocaleString() : "N/A",
        "Resolved At": incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : "N/A",
        "Response Time": formatDuration(responseTimeMinutes),
        "Resolution Time": formatDuration(resolutionTimeMinutes),
        "Assignment to Resolution Time": formatDuration(assignmentToResolutionMinutes),
        "Resolution Notes": incident.resolution_notes || "",
        "Photo URL": incident.photo_url || "",
        "Photo Count": Array.isArray(incident.photo_urls) ? incident.photo_urls.length : (incident.photo_url ? 1 : 0),
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
