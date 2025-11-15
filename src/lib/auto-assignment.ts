import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Types for auto-assignment
export interface AssignmentCriteria {
  incidentId: string
  incidentType: string
  location: {
    lat: number
    lng: number
  }
  barangay: string
  severity: number
  requiredSkills?: string[]
}

export interface VolunteerMatch {
  volunteerId: string
  firstName: string
  lastName: string
  phoneNumber: string
  skills: string[]
  assignedBarangays: string[]
  isAvailable: boolean
  currentAssignments: number
  distanceKm: number
  estimatedArrivalMinutes: number
  matchScore: number
}

export interface AssignmentResult {
  success: boolean
  assignedVolunteer?: VolunteerMatch
  message: string
  alternatives?: VolunteerMatch[]
}

export class AutoAssignmentService {
  private static instance: AutoAssignmentService
  private supabaseAdmin: any

  constructor() {
    this.supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }

  static getInstance(): AutoAssignmentService {
    if (!AutoAssignmentService.instance) {
      AutoAssignmentService.instance = new AutoAssignmentService()
    }
    return AutoAssignmentService.instance
  }

  /**
   * Automatically assign incident to best available volunteer
   */
  async assignIncident(criteria: AssignmentCriteria): Promise<AssignmentResult> {
    try {
      console.log('Starting auto-assignment for incident:', criteria.incidentId)

      // 1. Find available volunteers in the area
      const availableVolunteers = await this.findAvailableVolunteers(criteria)
      
      if (availableVolunteers.length === 0) {
        return {
          success: false,
          message: 'No available volunteers found in the area'
        }
      }

      // 2. Score and rank volunteers
      const scoredVolunteers = await this.scoreVolunteers(availableVolunteers, criteria)
      
      // 3. Select best match
      const bestMatch = scoredVolunteers[0]
      
      if (!bestMatch) {
        return {
          success: false,
          message: 'No suitable volunteer found'
        }
      }

      // 4. Perform assignment
      const assignmentResult = await this.performAssignment(criteria.incidentId, bestMatch.volunteerId)
      
      if (assignmentResult.success) {
      // 5. Send notification to assigned volunteer
      await this.notifyAssignedVolunteer(bestMatch, criteria)
      
      // 6. Start fallback monitoring for SMS backup
      try {
        const { volunteerFallbackService } = await import('./volunteer-fallback-service')
        await volunteerFallbackService.startFallbackMonitoring(criteria.incidentId, bestMatch.volunteerId)
      } catch (error) {
        console.error('Failed to start fallback monitoring:', error)
      }
        
        return {
          success: true,
          assignedVolunteer: bestMatch,
          message: `Incident assigned to ${bestMatch.firstName} ${bestMatch.lastName}`,
          alternatives: scoredVolunteers.slice(1, 4) // Top 3 alternatives
        }
      }

      return assignmentResult
    } catch (error: any) {
      console.error('Auto-assignment failed:', error)
      return {
        success: false,
        message: error.message || 'Auto-assignment failed'
      }
    }
  }

  /**
   * Find available volunteers within radius of incident
   */
  private async findAvailableVolunteers(criteria: AssignmentCriteria): Promise<VolunteerMatch[]> {
    try {
      const radiusKm = this.getSearchRadius(criteria.severity)
      
      // Try to use the RPC function first
      try {
        const { data, error } = await this.supabaseAdmin
          .rpc('get_volunteers_within_radius', {
            center_lat: criteria.location.lat,
            center_lng: criteria.location.lng,
            radius_km: radiusKm
          })
        
        // If the function exists and works, use it
        if (!error && data) {
          return data.map((volunteer: any) => ({
            volunteerId: volunteer.user_id,
            firstName: volunteer.first_name,
            lastName: volunteer.last_name,
            phoneNumber: volunteer.phone_number,
            skills: volunteer.skills || [],
            assignedBarangays: volunteer.assigned_barangays || [],
            isAvailable: volunteer.is_available,
            currentAssignments: 0, // Will be calculated later
            distanceKm: volunteer.distance_km,
            estimatedArrivalMinutes: Math.round(volunteer.distance_km * 2), // Rough estimate: 2 min per km
            matchScore: 0 // Will be calculated later
          }))
        }
      } catch (rpcError) {
        console.warn('RPC function not available, falling back to direct query:', rpcError)
      }
      
      // Use direct query instead of non-existent RPC function
      return await this.fallbackVolunteerSearch(criteria, radiusKm)
    } catch (error) {
      console.error('Error finding volunteers:', error)
      return []
    }
  }

  /**
   * Fallback method to find volunteers when RPC fails
   */
  private async fallbackVolunteerSearch(criteria: AssignmentCriteria, radiusKm: number): Promise<VolunteerMatch[]> {
    try {
      // Get all active volunteers
      const { data: volunteers, error } = await this.supabaseAdmin
        .from('volunteer_profiles')
        .select(`
          volunteer_user_id,
          is_available,
          skills,
          assigned_barangays,
          users!volunteer_profiles_volunteer_user_id_fkey (
            id,
            first_name,
            last_name,
            phone_number,
            role
          )
        `)
        .eq('is_available', true)
        .eq('users.role', 'volunteer')

      if (error) throw error

      // Filter by distance and availability
      const nearbyVolunteers: VolunteerMatch[] = []
      
      for (const volunteer of volunteers || []) {
        if (!volunteer.users) continue
        
        // Get volunteer's last known location
        const { data: location } = await this.supabaseAdmin
          .from('volunteer_locations')
          .select('lat, lng')
          .eq('user_id', volunteer.volunteer_user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!location?.lat || !location?.lng) continue

        const distance = this.calculateDistance(
          criteria.location.lat,
          criteria.location.lng,
          location.lat,
          location.lng
        )

        if (distance <= radiusKm) {
          // Get current assignments count
          const { count: assignmentCount } = await this.supabaseAdmin
            .from('incidents')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', volunteer.volunteer_user_id)
            .in('status', ['ASSIGNED', 'RESPONDING'])

          nearbyVolunteers.push({
            volunteerId: volunteer.volunteer_user_id,
            firstName: volunteer.users.first_name,
            lastName: volunteer.users.last_name,
            phoneNumber: volunteer.users.phone_number,
            skills: volunteer.skills || [],
            assignedBarangays: volunteer.assigned_barangays || [],
            isAvailable: volunteer.is_available,
            currentAssignments: assignmentCount || 0,
            distanceKm: distance,
            estimatedArrivalMinutes: Math.round(distance * 2), // Rough estimate: 2 min per km
            matchScore: 0 // Will be calculated later
          })
        }
      }

      return nearbyVolunteers
    } catch (error) {
      console.error('Fallback volunteer search failed:', error)
      return []
    }
  }

  /**
   * Score volunteers based on multiple criteria
   */
  private async scoreVolunteers(volunteers: VolunteerMatch[], criteria: AssignmentCriteria): Promise<VolunteerMatch[]> {
    return volunteers.map(volunteer => {
      let score = 0

      // Distance score (closer is better) - 40% weight
      const maxDistance = 10 // km
      const distanceScore = Math.max(0, (maxDistance - volunteer.distanceKm) / maxDistance)
      score += distanceScore * 40

      // Availability score (less assignments is better) - 30% weight
      const availabilityScore = Math.max(0, (3 - volunteer.currentAssignments) / 3)
      score += availabilityScore * 30

      // Skills match score - 20% weight
      const skillsScore = this.calculateSkillsMatch(volunteer.skills, criteria.requiredSkills || [])
      score += skillsScore * 20

      // Barangay coverage score - 10% weight
      const barangayScore = volunteer.assignedBarangays.includes(criteria.barangay.toUpperCase()) ? 1 : 0
      score += barangayScore * 10

      return {
        ...volunteer,
        matchScore: Math.round(score)
      }
    }).sort((a, b) => b.matchScore - a.matchScore)
  }

  /**
   * Calculate skills match percentage
   */
  private calculateSkillsMatch(volunteerSkills: string[], requiredSkills: string[]): number {
    if (requiredSkills.length === 0) return 1 // No requirements = perfect match
    
    const matches = requiredSkills.filter(skill => 
      volunteerSkills.some(vSkill => 
        vSkill.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(vSkill.toLowerCase())
      )
    ).length

    return matches / requiredSkills.length
  }

  /**
   * Get search radius based on incident severity
   */
  private getSearchRadius(severity: number): number {
    switch (severity) {
      case 1: return 15 // Critical - search wider
      case 2: return 12 // High
      case 3: return 8  // Medium
      case 4: return 5  // Low
      case 5: return 3  // Very low
      default: return 8
    }
  }

  /**
   * Calculate distance between two points in kilometers
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLng = this.toRadians(lng2 - lng1)
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Perform the actual assignment
   */
  private async performAssignment(incidentId: string, volunteerId: string): Promise<AssignmentResult> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('incidents')
        .update({
          assigned_to: volunteerId,
          assigned_at: new Date().toISOString(),
          status: 'ASSIGNED',
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId)
        .eq('status', 'PENDING')
        .select()
        .single()

      if (error) throw error

      // Log the assignment
      await this.supabaseAdmin.from('incident_updates').insert({
        incident_id: incidentId,
        updated_by: null, // System assignment
        previous_status: 'PENDING',
        new_status: 'ASSIGNED',
        notes: 'Automatically assigned by system',
        created_at: new Date().toISOString()
      })

      return {
        success: true,
        message: 'Incident assigned successfully'
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Assignment failed'
      }
    }
  }

  /**
   * Send notification to assigned volunteer
   */
  private async notifyAssignedVolunteer(volunteer: VolunteerMatch, criteria: AssignmentCriteria): Promise<void> {
    try {
      // Use centralized notification service
      const { notificationService } = await import('@/lib/notification-service')
      const { data: incident } = await this.supabaseAdmin
        .from('incidents')
        .select('id, incident_type, barangay')
        .eq('id', criteria.incidentId)
        .single()

      if (incident) {
        await notificationService.onVolunteerAssigned(volunteer.volunteerId, incident)
      }
    } catch (error) {
      console.error('Failed to notify assigned volunteer:', error)
    }
  }

  /**
   * Check if auto-assignment should be triggered
   */
  async shouldAutoAssign(incidentId: string): Promise<boolean> {
    try {
      const { data: incident } = await this.supabaseAdmin
        .from('incidents')
        .select('status, created_at, severity')
        .eq('id', incidentId)
        .single()

      if (!incident) return false

      // Only auto-assign if incident is still pending
      if (incident.status !== 'PENDING') return false

      // Don't auto-assign very low priority incidents immediately
      if (incident.severity === 5) {
        const createdAt = new Date(incident.created_at)
        const now = new Date()
        const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60)
        
        // Wait 10 minutes before auto-assigning low priority incidents
        if (minutesSinceCreation < 10) return false
      }

      return true
    } catch (error) {
      console.error('Error checking auto-assignment eligibility:', error)
      return false
    }
  }
}

// Export singleton instance
export const autoAssignmentService = AutoAssignmentService.getInstance()
