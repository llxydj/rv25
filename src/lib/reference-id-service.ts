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
      let serverSupabase
      try {
        serverSupabase = getSimpleServerSupabase()
      } catch (supabaseError: any) {
        console.warn('Reference ID service unavailable - Supabase client initialization failed:', supabaseError?.message)
        return { success: false, error: 'Reference ID service unavailable' }
      }
      // Check if reference ID already exists
      const { data: existing, error: checkError } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .select('reference_id')
        .eq('incident_id', incidentId)
        .maybeSingle()

      // If table doesn't exist, fail gracefully
      if (checkError && (checkError.code === '42P01' || checkError.message.includes('does not exist'))) {
        console.warn('Reference ID table not available')
        return { success: false, error: 'Reference ID service unavailable' }
      }

      // PGRST116 = no rows returned (not an error, just means it doesn't exist yet)
      if (checkError && checkError.code === 'PGRST116') {
        // Reference ID doesn't exist yet, continue to create it
      } else if (checkError) {
        // Other error
        console.warn('Error checking for existing reference ID:', checkError)
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
          .maybeSingle()

        // If table doesn't exist, fail gracefully
        if (existError && (existError.code === '42P01' || existError.message.includes('does not exist'))) {
          console.warn('Reference ID table not available')
          return { success: false, error: 'Reference ID service unavailable' }
        }

        // PGRST116 = no rows returned (reference ID is available, continue)
        if (existError && existError.code === 'PGRST116') {
          break // Reference ID doesn't exist, we can use it
        }

        // Other error
        if (existError) {
          console.warn('Error checking reference ID uniqueness:', existError)
          continue // Try another reference ID
        }

        // If existingRef is null, the reference ID is available
        if (!existingRef) {
          break
        }

        if (attempts >= maxAttempts) {
          throw new Error('Unable to generate unique reference ID')
        }
      } while (true)

      // Insert the mapping with conflict handling
      // Handle race condition where trigger might have created it between check and insert
      const { data: insertedData, error } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .insert({
          incident_id: incidentId,
          reference_id: referenceId,
          created_at: new Date().toISOString()
        })
        .select('reference_id')
        .single()

      // If duplicate key error (23505), it means trigger already created it
      // Fetch the existing one instead
      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
          // Reference ID was already created (likely by trigger), fetch it
          const { data: existingData, error: fetchError } = await (serverSupabase as SupabaseClient)
            .from('incident_reference_ids')
            .select('reference_id')
            .eq('incident_id', incidentId)
            .maybeSingle()
          
          if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 means not found, but we just got a duplicate key error, so it should exist
            // If it's a different error, log it
            if (fetchError.code !== 'PGRST116') {
              console.warn('Failed to fetch existing reference ID after duplicate key error:', fetchError)
            }
          }
          
          if (existingData && (existingData as any).reference_id) {
            return { success: true, referenceId: (existingData as any).reference_id }
          }
          
          // If we can't fetch it but got duplicate key error, something is wrong
          console.warn('Duplicate key error but could not fetch reference ID')
          // Continue to return error
        }
        throw error
      }

      return { success: true, referenceId: insertedData ? (insertedData as any).reference_id : referenceId }
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
      let serverSupabase
      try {
        serverSupabase = getSimpleServerSupabase()
      } catch (supabaseError: any) {
        console.warn('Reference ID service unavailable - Supabase client initialization failed:', supabaseError?.message)
        return { success: false, error: 'Reference ID service unavailable' }
      }
      const { data, error } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .select('reference_id')
        .eq('incident_id', incidentId)
        .maybeSingle()

      // If table doesn't exist, return gracefully
      if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
        console.warn('Reference ID table not available:', error.message)
        return { success: false, error: 'Reference ID service unavailable' }
      }
      
      // PGRST116 = no rows returned (reference ID doesn't exist yet)
      if (error && error.code === 'PGRST116') {
        // Try to create it
        return await this.createReferenceId(incidentId)
      }
      
      // Other error
      if (error) {
        console.warn('Reference ID service error:', error.message)
        return { success: false, error: 'Reference ID service unavailable' }
      }
      
      if (!data) {
        // No data returned, try to create reference ID
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
      let serverSupabase
      try {
        serverSupabase = getSimpleServerSupabase()
      } catch (supabaseError: any) {
        console.warn('Reference ID service unavailable - Supabase client initialization failed:', supabaseError?.message)
        return { success: false, error: 'Reference ID service unavailable' }
      }
      const { data, error } = await (serverSupabase as SupabaseClient)
        .from('incident_reference_ids')
        .select('incident_id')
        .eq('reference_id', referenceId)
        .maybeSingle()

      // If table doesn't exist, return gracefully
      if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
        console.warn('Reference ID table not available:', error.message)
        return { success: false, error: 'Reference ID service unavailable' }
      }

      // PGRST116 = no rows returned (reference ID not found)
      if (error && error.code === 'PGRST116') {
        return { success: false, error: 'Reference ID not found' }
      }

      // Other error
      if (error) {
        console.error('Error getting incident ID:', error)
        return { success: false, error: error.message }
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
      let serverSupabase
      try {
        serverSupabase = getSimpleServerSupabase()
      } catch (supabaseError: any) {
        console.warn('Reference ID service unavailable - Supabase client initialization failed:', supabaseError?.message)
        return { success: false, error: 'Reference ID service unavailable' }
      }
      // FIX: Query from incidents table and join reference_ids to avoid ambiguous column reference
      // This prevents "column reference 'reference_id' is ambiguous" error
      const { data: incidentsData, error: incidentsError } = await (serverSupabase as SupabaseClient)
        .from('incidents')
        .select(`
          id,
          reporter_id,
          assigned_to,
          incident_reference_ids!inner (
            reference_id,
            created_at
          )
        `)
        .or(`reporter_id.eq.${userId},assigned_to.eq.${userId}`)
      
      if (incidentsError) {
        // If table doesn't exist, return gracefully
        if (incidentsError.code === '42P01' || incidentsError.message.includes('does not exist')) {
          console.warn('Reference ID table not available:', incidentsError.message)
          return { success: false, error: 'Reference ID service unavailable' }
        }
        throw incidentsError
      }
      
      // Transform the data to match the expected ReferenceIdMapping format
      // Filter out items without reference_id and ensure all required fields are strings
      const data: ReferenceIdMapping[] = (incidentsData || [])
        .map((incident: any) => {
          const refData = Array.isArray(incident.incident_reference_ids) 
            ? incident.incident_reference_ids[0] 
            : incident.incident_reference_ids
          
          if (!refData?.reference_id) {
            return null
          }
          
          return {
            incident_id: incident.id,
            reference_id: refData.reference_id,
            created_at: refData.created_at || new Date().toISOString() // Fallback to current time if missing
          }
        })
        .filter((item): item is ReferenceIdMapping => item !== null)
      
      const error = null

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
