/**
 * Reference ID Service
 * Generates short, human-readable reference IDs for incidents
 * while maintaining UUID compatibility for database operations
 */

import { getSimpleServerSupabase } from './supabase-server-simple'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReferenceIdMapping {
  incident_id: string
  reference_id: string
  created_at: string
}

export class ReferenceIdService {
  private static instance: ReferenceIdService
  private readonly PREFIX = 'TC' // Talisay City
  private readonly LENGTH = 4
  private readonly CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  static getInstance(): ReferenceIdService {
    if (!ReferenceIdService.instance) {
      ReferenceIdService.instance = new ReferenceIdService()
    }
    return ReferenceIdService.instance
  }

  /**
   * Generate a short reference ID
   */
  private generateReferenceId(): string {
    let result = ''
    for (let i = 0; i < this.LENGTH; i++) {
      result += this.CHARS.charAt(Math.floor(Math.random() * this.CHARS.length))
    }
    return `${this.PREFIX}-${result}`
  }

  /**
   * Create a reference ID for an incident
   */
  async createReferenceId(incidentId: string): Promise<{ success: boolean; referenceId?: string; error?: string }> {
    try {
      const serverSupabase = getSimpleServerSupabase()
      // Check if reference ID already exists
      const { data: existing, error: checkError } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .select('reference_id')
        .eq('incident_id', incidentId)
        .single()

      // If table doesn't exist, fail gracefully
      if (checkError && (checkError.code === '42P01' || checkError.message.includes('does not exist'))) {
        console.warn('Reference ID table not available')
        return { success: false, error: 'Reference ID service unavailable' }
      }

      if (existing && (existing as any).reference_id) {
        return { success: true, referenceId: (existing as any).reference_id }
      }

      // Generate unique reference ID
      let referenceId: string
      let attempts = 0
      const maxAttempts = 10

      do {
        referenceId = this.generateReferenceId()
        attempts++

        // Check if reference ID already exists
        const { data: existingRef, error: existError } = await (serverSupabase as SupabaseClient)
          .from('incident_reference_ids')
          .select('reference_id')
          .eq('reference_id', referenceId)
          .single()

        // If table doesn't exist, fail gracefully
        if (existError && (existError.code === '42P01' || existError.message.includes('does not exist'))) {
          console.warn('Reference ID table not available')
          return { success: false, error: 'Reference ID service unavailable' }
        }

        if (!existingRef) break

        if (attempts >= maxAttempts) {
          throw new Error('Unable to generate unique reference ID')
        }
      } while (true)

      // Insert the mapping
      const { error } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .insert({
          incident_id: incidentId,
          reference_id: referenceId,
          created_at: new Date().toISOString()
        })

      if (error) throw error

      return { success: true, referenceId }
    } catch (error: any) {
      console.error('Error creating reference ID:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get reference ID for an incident
   */
  async getReferenceId(incidentId: string): Promise<{ success: boolean; referenceId?: string; error?: string }> {
    try {
      const serverSupabase = getSimpleServerSupabase()
      const { data, error } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .select('reference_id')
        .eq('incident_id', incidentId)
        .single()

      // If table doesn't exist or other database error, return gracefully
      if (error) {
        // 42P01 = table does not exist, PGRST116 = no rows returned
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.warn('Reference ID table not available:', error.message)
          return { success: false, error: 'Reference ID service unavailable' }
        }
        // PGRST116 = no rows returned, try to create
        if (error.code === 'PGRST116') {
          return await this.createReferenceId(incidentId)
        }
        // Other error - fail silently
        console.warn('Reference ID service error:', error.message)
        return { success: false, error: 'Reference ID service unavailable' }
      }
      
      if (!data) {
        // Create reference ID if it doesn't exist
        return await this.createReferenceId(incidentId)
      }

      return { success: true, referenceId: (data as any).reference_id }
    } catch (error: any) {
      // Fail silently - don't spam console with errors
      console.warn('Reference ID service error:', error.message || 'Unknown error')
      return { success: false, error: error.message || 'Service unavailable' }
    }
  }

  /**
   * Get incident ID from reference ID
   */
  async getIncidentId(referenceId: string): Promise<{ success: boolean; incidentId?: string; error?: string }> {
    try {
      const serverSupabase = getSimpleServerSupabase()
      const { data, error } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .select('incident_id')
        .eq('reference_id', referenceId)
        .single()

      // If table doesn't exist, return gracefully
      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.warn('Reference ID table not available:', error.message)
          return { success: false, error: 'Reference ID service unavailable' }
        }
        throw error
      }

      if (!data) {
        return { success: false, error: 'Reference ID not found' }
      }

      return { success: true, incidentId: (data as any).incident_id }
    } catch (error: any) {
      console.error('Error getting incident ID:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all reference IDs for a user's incidents
   */
  async getUserReferenceIds(userId: string): Promise<{ success: boolean; mappings?: ReferenceIdMapping[]; error?: string }> {
    try {
      const serverSupabase = getSimpleServerSupabase()
      const { data, error } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .select(`
          incident_id,
          reference_id,
          created_at,
          incidents!inner (
            reporter_id,
            assigned_to
          )
        `)
        .or(`incidents.reporter_id.eq.${userId},incidents.assigned_to.eq.${userId}`)

      // If table doesn't exist, return gracefully
      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.warn('Reference ID table not available:', error.message)
          return { success: false, error: 'Reference ID service unavailable' }
        }
        throw error
      }

      return { success: true, mappings: data || [] }
    } catch (error: any) {
      console.error('Error getting user reference IDs:', error)
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const referenceIdService = ReferenceIdService.getInstance()
