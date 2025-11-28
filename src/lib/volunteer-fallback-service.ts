"use client"

import { createClient } from '@supabase/supabase-js'
import { smsService } from '@/lib/sms-service'

export interface VolunteerFallbackConfig {
  enabled: boolean
  timeoutMinutes: number
  retryAttempts: number
  fallbackTemplates: {
    assignment: string
    reminder: string
    escalation: string
  }
}

export class VolunteerFallbackService {
  private static instance: VolunteerFallbackService
  private supabaseAdmin: any
  private fallbackTimers: Map<string, NodeJS.Timeout> = new Map()
  private reminderTimers: Map<string, NodeJS.Timeout> = new Map() // Track reminder timers separately

  constructor() {
    this.supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }

  static getInstance(): VolunteerFallbackService {
    if (!VolunteerFallbackService.instance) {
      VolunteerFallbackService.instance = new VolunteerFallbackService()
    }
    return VolunteerFallbackService.instance
  }

  /**
   * Start fallback monitoring for an assigned incident
   */
  async startFallbackMonitoring(incidentId: string, volunteerId: string): Promise<void> {
    try {
      console.log(`Starting fallback monitoring for incident ${incidentId}, volunteer ${volunteerId}`)

      // Clear any existing timer for this incident
      this.clearFallbackTimer(incidentId)

      // Get incident details
      const { data: incident } = await this.supabaseAdmin
        .from('incidents')
        .select(`
          id,
          incident_type,
          barangay,
          created_at,
          assigned_at,
          assigned_to,
          status
        `)
        .eq('id', incidentId)
        .single()

      if (!incident) {
        console.error(`Incident ${incidentId} not found`)
        return
      }

      // Get volunteer details
      const { data: volunteer } = await this.supabaseAdmin
        .from('users')
        .select('id, phone_number, first_name, last_name')
        .eq('id', volunteerId)
        .single()

      if (!volunteer?.phone_number) {
        console.error(`Volunteer ${volunteerId} not found or no phone number`)
        return
      }

      // Get or create proper reference ID
      const { referenceIdService } = await import('@/lib/reference-id-service')
      const referenceResult = await referenceIdService.getReferenceId(incidentId)
      const referenceId = referenceResult.success && referenceResult.referenceId 
        ? referenceResult.referenceId 
        : this.generateReferenceId(incidentId) // Fallback to simple ID

      // Set fallback timer (60 seconds default)
      const timeoutMs = 60 * 1000 // 60 seconds
      const timer = setTimeout(async () => {
        await this.checkAndSendFallback(incident, volunteer, referenceId)
      }, timeoutMs)

      this.fallbackTimers.set(incidentId, timer)

      // Log the fallback monitoring start
      await this.logFallbackEvent(incidentId, volunteerId, 'MONITORING_STARTED', {
        timeout_ms: timeoutMs,
        reference_id: referenceId
      })

    } catch (error) {
      console.error('Error starting fallback monitoring:', error)
    }
  }

  /**
   * Stop fallback monitoring for an incident
   */
  async stopFallbackMonitoring(incidentId: string, reason: string = 'MANUAL_STOP'): Promise<void> {
    try {
      console.log(`Stopping fallback monitoring for incident ${incidentId}: ${reason}`)

      this.clearFallbackTimer(incidentId)

      // Log the fallback monitoring stop
      await this.logFallbackEvent(incidentId, null, 'MONITORING_STOPPED', {
        reason
      })

    } catch (error) {
      console.error('Error stopping fallback monitoring:', error)
    }
  }

  /**
   * Check if volunteer has acknowledged the assignment and send fallback if needed
   */
  private async checkAndSendFallback(
    incident: any,
    volunteer: any,
    referenceId: string
  ): Promise<void> {
    try {
      console.log(`Checking fallback for incident ${incident.id}`)

      // Check if incident is still assigned to this volunteer
      const { data: currentIncident } = await this.supabaseAdmin
        .from('incidents')
        .select('assigned_to, status')
        .eq('id', incident.id)
        .single()

      if (!currentIncident || currentIncident.assigned_to !== volunteer.id) {
        console.log(`Incident ${incident.id} no longer assigned to volunteer ${volunteer.id}`)
        return
      }

      // Check if volunteer has acknowledged (status changed from ASSIGNED)
      if (currentIncident.status !== 'ASSIGNED') {
        console.log(`Volunteer ${volunteer.id} has acknowledged incident ${incident.id}`)
        return
      }

      // Check if push notification was delivered successfully
      const hasPushAcknowledgment = await this.checkPushAcknowledgment(incident.id, volunteer.id)
      
      if (hasPushAcknowledgment) {
        console.log(`Push notification acknowledged for incident ${incident.id}`)
        return
      }

      // Send SMS fallback
      await this.sendSMSFallback(incident, volunteer, referenceId)

    } catch (error) {
      console.error('Error in fallback check:', error)
    }
  }

  /**
   * Send SMS fallback to volunteer
   */
  private async sendSMSFallback(
    incident: any,
    volunteer: any,
    referenceId: string
  ): Promise<void> {
    try {
      console.log(`Sending SMS fallback for incident ${incident.id} to volunteer ${volunteer.id}`)

      const smsResult = await smsService.sendVolunteerFallback(
        incident.id,
        referenceId,
        volunteer.phone_number,
        volunteer.id,
        {
          type: incident.incident_type,
          barangay: incident.barangay,
          time: new Date(incident.assigned_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        }
      )

      if (smsResult.success) {
        console.log(`SMS fallback sent successfully for incident ${incident.id}`)
        
        // Log successful fallback
        await this.logFallbackEvent(incident.id, volunteer.id, 'SMS_FALLBACK_SENT', {
          reference_id: referenceId,
          sms_result: smsResult
        })

        // Set reminder timer for 5 minutes if still not acknowledged
        // Clear any existing reminder timer first to prevent duplicates
        this.clearReminderTimer(incident.id)
        
        const reminderTimer = setTimeout(async () => {
          await this.checkAndSendReminder(incident, volunteer, referenceId)
          this.reminderTimers.delete(incident.id) // Clean up after execution
        }, 5 * 60 * 1000) // 5 minutes
        
        this.reminderTimers.set(incident.id, reminderTimer)

      } else {
        console.error(`SMS fallback failed for incident ${incident.id}:`, smsResult.error)
        
        // Log failed fallback
        await this.logFallbackEvent(incident.id, volunteer.id, 'SMS_FALLBACK_FAILED', {
          reference_id: referenceId,
          error: smsResult.error
        })
      }

    } catch (error) {
      console.error('Error sending SMS fallback:', error)
    }
  }

  /**
   * Send reminder SMS if volunteer still hasn't acknowledged
   */
  private async checkAndSendReminder(
    incident: any,
    volunteer: any,
    referenceId: string
  ): Promise<void> {
    try {
      // Check if incident is still assigned and not acknowledged
      const { data: currentIncident } = await this.supabaseAdmin
        .from('incidents')
        .select('assigned_to, status')
        .eq('id', incident.id)
        .single()

      if (!currentIncident || 
          currentIncident.assigned_to !== volunteer.id || 
          currentIncident.status !== 'ASSIGNED') {
        return
      }

      // Send reminder SMS
      const reminderResult = await smsService.sendSMS(
        volunteer.phone_number,
        'TEMPLATE_VOLUNTEER_REMINDER',
        {
          ref: referenceId,
          type: incident.incident_type,
          barangay: incident.barangay,
          time: new Date(incident.assigned_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        },
        {
          incidentId: incident.id,
          referenceId,
          triggerSource: 'Volunteer_Reminder',
          recipientUserId: volunteer.id
        }
      )

      if (reminderResult.success) {
        console.log(`Reminder SMS sent for incident ${incident.id}`)
        
        await this.logFallbackEvent(incident.id, volunteer.id, 'REMINDER_SENT', {
          reference_id: referenceId
        })
      }

    } catch (error) {
      console.error('Error sending reminder:', error)
    }
  }

  /**
   * Check if push notification was acknowledged
   */
  private async checkPushAcknowledgment(incidentId: string, volunteerId: string): Promise<boolean> {
    try {
      // Check if volunteer has viewed the incident in the app
      const { data: viewLog, error } = await this.supabaseAdmin
        .from('incident_views')
        .select('id')
        .eq('incident_id', incidentId)
        .eq('user_id', volunteerId)
        .gte('viewed_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Last 2 minutes
        .limit(1)

      // If table doesn't exist, return false gracefully
      if (error && error.message.includes('does not exist')) {
        console.warn('incident_views table not found, falling back to basic acknowledgment check')
        return false
      }

      return !!viewLog && viewLog.length > 0
    } catch (error) {
      console.error('Error checking push acknowledgment:', error)
      return false
    }
  }

  /**
   * Clear reminder timer for an incident
   */
  private clearReminderTimer(incidentId: string): void {
    const timer = this.reminderTimers.get(incidentId)
    if (timer) {
      clearTimeout(timer)
      this.reminderTimers.delete(incidentId)
      console.log(`Cleared reminder timer for incident ${incidentId}`)
    }
  }

  /**
   * Clear fallback timer for an incident
   */
  private clearFallbackTimer(incidentId: string): void {
    const timer = this.fallbackTimers.get(incidentId)
    if (timer) {
      clearTimeout(timer)
      this.fallbackTimers.delete(incidentId)
    }
  }

  /**
   * Generate short reference ID from UUID
   */
  private generateReferenceId(uuid: string): string {
    const parts = uuid.split('-')
    const prefix = parts[0].substring(0, 2).toUpperCase()
    const suffix = parts[1].substring(0, 3).toUpperCase()
    return `${prefix}${suffix}`
  }

  /**
   * Log fallback events for monitoring
   */
  private async logFallbackEvent(
    incidentId: string,
    volunteerId: string | null,
    eventType: string,
    metadata: any
  ): Promise<void> {
    try {
      await this.supabaseAdmin.from('volunteer_fallback_logs').insert({
        incident_id: incidentId,
        volunteer_id: volunteerId,
        event_type: eventType,
        metadata: metadata,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error logging fallback event:', error)
    }
  }

  /**
   * Get fallback statistics
   */
  async getFallbackStats(): Promise<{
    totalFallbacks: number
    successfulFallbacks: number
    failedFallbacks: number
    activeMonitoring: number
  }> {
    try {
      const { data: logs } = await this.supabaseAdmin
        .from('volunteer_fallback_logs')
        .select('event_type')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (!logs) {
        return {
          totalFallbacks: 0,
          successfulFallbacks: 0,
          failedFallbacks: 0,
          activeMonitoring: this.fallbackTimers.size
        }
      }

      const totalFallbacks = logs.filter((log: any) => log.event_type === 'SMS_FALLBACK_SENT').length
      const successfulFallbacks = logs.filter((log: any) => log.event_type === 'SMS_FALLBACK_SENT').length
      const failedFallbacks = logs.filter((log: any) => log.event_type === 'SMS_FALLBACK_FAILED').length

      return {
        totalFallbacks,
        successfulFallbacks,
        failedFallbacks,
        activeMonitoring: this.fallbackTimers.size
      }
    } catch (error) {
      console.error('Error getting fallback stats:', error)
      return {
        totalFallbacks: 0,
        successfulFallbacks: 0,
        failedFallbacks: 0,
        activeMonitoring: 0
      }
    }
  }

  /**
   * Clean up expired timers
   */
  cleanupExpiredTimers(): void {
    // This would typically be called periodically to clean up any orphaned timers
    console.log(`Active fallback timers: ${this.fallbackTimers.size}`)
  }
}

// Export singleton instance
export const volunteerFallbackService = VolunteerFallbackService.getInstance()
