"use client"

import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export interface VolunteerAvailability {
  volunteerId: string
  isAvailable: boolean
  currentAssignments: number
  maxAssignments: number
  lastStatusChange: string
  statusReason?: string
  estimatedAvailableAt?: string
}

export interface AvailabilityUpdate {
  volunteerId: string
  isAvailable: boolean
  reason?: string
  estimatedAvailableAt?: string
}

export class VolunteerAvailabilityService {
  private static instance: VolunteerAvailabilityService
  private supabaseAdmin: any

  constructor() {
    this.supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }

  static getInstance(): VolunteerAvailabilityService {
    if (!VolunteerAvailabilityService.instance) {
      VolunteerAvailabilityService.instance = new VolunteerAvailabilityService()
    }
    return VolunteerAvailabilityService.instance
  }

  /**
   * Update volunteer availability status
   */
  async updateAvailability(update: AvailabilityUpdate): Promise<{ success: boolean; message: string }> {
    try {
      const { volunteerId, isAvailable, reason, estimatedAvailableAt } = update

      // Get current volunteer profile
      const { data: profile, error: profileError } = await this.supabaseAdmin
        .from('volunteer_profiles')
        .select('*')
        .eq('volunteer_user_id', volunteerId)
        .single()

      if (profileError) throw profileError

      // Update availability status
      const { error: updateError } = await this.supabaseAdmin
        .from('volunteer_profiles')
        .update({
          is_available: isAvailable,
          last_status_change: new Date().toISOString(),
          last_status_changed_by: volunteerId, // Self-update
          notes: reason ? `${profile.notes || ''}\n${new Date().toISOString()}: ${reason}`.trim() : profile.notes
        })
        .eq('volunteer_user_id', volunteerId)

      if (updateError) throw updateError

      // Log the availability change
      await this.logAvailabilityChange(volunteerId, profile.is_available, isAvailable, reason)

      return {
        success: true,
        message: `Availability updated to ${isAvailable ? 'available' : 'unavailable'}`
      }
    } catch (error: any) {
      console.error('Error updating volunteer availability:', error)
      return {
        success: false,
        message: error.message || 'Failed to update availability'
      }
    }
  }

  /**
   * Get current availability status for a volunteer
   */
  async getVolunteerAvailability(volunteerId: string): Promise<VolunteerAvailability | null> {
    try {
      // Get volunteer profile
      const { data: profile, error: profileError } = await this.supabaseAdmin
        .from('volunteer_profiles')
        .select('*')
        .eq('volunteer_user_id', volunteerId)
        .single()

      if (profileError) throw profileError

      // Get current assignments count
      const { count: currentAssignments } = await this.supabaseAdmin
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', volunteerId)
        .in('status', ['ASSIGNED', 'RESPONDING'])

      // Determine max assignments based on volunteer profile
      const maxAssignments = this.getMaxAssignments(profile)

      return {
        volunteerId,
        isAvailable: profile.is_available && (currentAssignments || 0) < maxAssignments,
        currentAssignments: currentAssignments || 0,
        maxAssignments,
        lastStatusChange: profile.last_status_change,
        statusReason: this.extractLatestReason(profile.notes),
        estimatedAvailableAt: this.calculateEstimatedAvailableAt(profile, currentAssignments || 0)
      }
    } catch (error) {
      console.error('Error getting volunteer availability:', error)
      return null
    }
  }

  /**
   * Get all available volunteers with their current status
   */
  async getAllAvailableVolunteers(): Promise<VolunteerAvailability[]> {
    try {
      const { data: profiles, error } = await this.supabaseAdmin
        .from('volunteer_profiles')
        .select(`
          volunteer_user_id,
          is_available,
          last_status_change,
          notes,
          users!volunteer_profiles_volunteer_user_id_fkey (
            id,
            first_name,
            last_name,
            role
          )
        `)
        .eq('users.role', 'volunteer')

      if (error) throw error

      const availabilities: VolunteerAvailability[] = []

      for (const profile of profiles || []) {
        if (!profile.users) continue

        // Get current assignments for this volunteer
        const { count: currentAssignments } = await this.supabaseAdmin
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', profile.volunteer_user_id)
          .in('status', ['ASSIGNED', 'RESPONDING'])

        const maxAssignments = this.getMaxAssignments(profile)
        const isActuallyAvailable = profile.is_available && (currentAssignments || 0) < maxAssignments

        availabilities.push({
          volunteerId: profile.volunteer_user_id,
          isAvailable: isActuallyAvailable,
          currentAssignments: currentAssignments || 0,
          maxAssignments,
          lastStatusChange: profile.last_status_change,
          statusReason: this.extractLatestReason(profile.notes),
          estimatedAvailableAt: this.calculateEstimatedAvailableAt(profile, currentAssignments || 0)
        })
      }

      return availabilities
    } catch (error) {
      console.error('Error getting all available volunteers:', error)
      return []
    }
  }

  /**
   * Automatically update availability based on current assignments
   */
  async updateAvailabilityBasedOnAssignments(volunteerId: string): Promise<void> {
    try {
      const availability = await this.getVolunteerAvailability(volunteerId)
      if (!availability) return

      const shouldBeAvailable = availability.currentAssignments < availability.maxAssignments
      
      if (availability.isAvailable !== shouldBeAvailable) {
        await this.updateAvailability({
          volunteerId,
          isAvailable: shouldBeAvailable,
          reason: shouldBeAvailable 
            ? 'Automatically available - assignments completed'
            : 'Automatically unavailable - at capacity'
        })
      }
    } catch (error) {
      console.error('Error updating availability based on assignments:', error)
    }
  }

  /**
   * Get volunteers who are approaching capacity
   */
  async getVolunteersApproachingCapacity(): Promise<VolunteerAvailability[]> {
    try {
      const allVolunteers = await this.getAllAvailableVolunteers()
      
      return allVolunteers.filter(volunteer => {
        const capacityPercentage = volunteer.currentAssignments / volunteer.maxAssignments
        return capacityPercentage >= 0.8 // 80% capacity or higher
      })
    } catch (error) {
      console.error('Error getting volunteers approaching capacity:', error)
      return []
    }
  }

  /**
   * Get volunteers who are overloaded (over capacity)
   */
  async getOverloadedVolunteers(): Promise<VolunteerAvailability[]> {
    try {
      const allVolunteers = await this.getAllAvailableVolunteers()
      
      return allVolunteers.filter(volunteer => 
        volunteer.currentAssignments > volunteer.maxAssignments
      )
    } catch (error) {
      console.error('Error getting overloaded volunteers:', error)
      return []
    }
  }

  /**
   * Calculate estimated time when volunteer will be available
   */
  private calculateEstimatedAvailableAt(profile: any, currentAssignments: number): string | undefined {
    if (currentAssignments === 0) return undefined

    // Get average resolution time for this volunteer
    const { data: resolvedIncidents } = this.supabaseAdmin
      .from('incidents')
      .select('created_at, resolved_at')
      .eq('assigned_to', profile.volunteer_user_id)
      .eq('status', 'RESOLVED')
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(10)

    if (!resolvedIncidents || resolvedIncidents.length === 0) {
      // Default estimate: 2 hours per incident
      const estimatedMinutes = currentAssignments * 120
      const estimatedTime = new Date(Date.now() + estimatedMinutes * 60 * 1000)
      return estimatedTime.toISOString()
    }

    // FIXED: Calculate average resolution time with validation to prevent negative times
    const totalMinutes = resolvedIncidents.reduce((sum: number, incident: any) => {
      const created = new Date(incident.created_at)
      const resolved = new Date(incident.resolved_at)
      // Validate dates and ensure resolved >= created
      if (!isNaN(created.getTime()) && !isNaN(resolved.getTime()) && resolved >= created) {
        const timeDiff = (resolved.getTime() - created.getTime()) / (1000 * 60)
        return sum + (timeDiff >= 0 ? timeDiff : 0)
      }
      return sum
    }, 0)

    const averageMinutes = totalMinutes / resolvedIncidents.length
    const estimatedMinutes = currentAssignments * averageMinutes
    const estimatedTime = new Date(Date.now() + estimatedMinutes * 60 * 1000)
    
    return estimatedTime.toISOString()
  }

  /**
   * Determine maximum assignments for a volunteer
   */
  private getMaxAssignments(profile: any): number {
    // Base capacity
    let maxAssignments = 2

    // Adjust based on skills
    const skills = profile.skills || []
    if (skills.includes('LEADERSHIP')) maxAssignments += 1
    if (skills.includes('MEDICAL PROFESSIONAL')) maxAssignments += 1
    if (skills.includes('EMERGENCY RESPONSE')) maxAssignments += 1

    // Adjust based on experience (total incidents resolved)
    const totalResolved = profile.total_incidents_resolved || 0
    if (totalResolved > 50) maxAssignments += 1
    if (totalResolved > 100) maxAssignments += 1

    // Cap at reasonable maximum
    return Math.min(maxAssignments, 5)
  }

  /**
   * Extract latest reason from notes
   */
  private extractLatestReason(notes: string | null): string | undefined {
    if (!notes) return undefined
    
    const lines = notes.split('\n')
    const lastLine = lines[lines.length - 1]
    
    if (lastLine.includes(':')) {
      return lastLine.split(':').slice(1).join(':').trim()
    }
    
    return undefined
  }

  /**
   * Log availability changes
   */
  private async logAvailabilityChange(
    volunteerId: string, 
    previousStatus: boolean, 
    newStatus: boolean, 
    reason?: string
  ): Promise<void> {
    try {
      await this.supabaseAdmin.from('volunteer_availability_log').insert({
        volunteer_id: volunteerId,
        previous_status: previousStatus,
        new_status: newStatus,
        reason: reason || 'Manual update',
        changed_at: new Date().toISOString(),
        changed_by: volunteerId
      })
    } catch (error) {
      console.error('Error logging availability change:', error)
      // Don't fail the main operation if logging fails
    }
  }

  /**
   * Get availability statistics
   */
  async getAvailabilityStats(): Promise<{
    totalVolunteers: number
    availableVolunteers: number
    unavailableVolunteers: number
    approachingCapacity: number
    overloaded: number
  }> {
    try {
      const allVolunteers = await this.getAllAvailableVolunteers()
      const approachingCapacity = await this.getVolunteersApproachingCapacity()
      const overloaded = await this.getOverloadedVolunteers()

      return {
        totalVolunteers: allVolunteers.length,
        availableVolunteers: allVolunteers.filter(v => v.isAvailable).length,
        unavailableVolunteers: allVolunteers.filter(v => !v.isAvailable).length,
        approachingCapacity: approachingCapacity.length,
        overloaded: overloaded.length
      }
    } catch (error) {
      console.error('Error getting availability stats:', error)
      return {
        totalVolunteers: 0,
        availableVolunteers: 0,
        unavailableVolunteers: 0,
        approachingCapacity: 0,
        overloaded: 0
      }
    }
  }
}

// Export singleton instance
export const volunteerAvailabilityService = VolunteerAvailabilityService.getInstance()
