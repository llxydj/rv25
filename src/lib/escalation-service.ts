"use client"

import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { autoAssignmentService } from './auto-assignment'

export interface EscalationRule {
  id: string
  name: string
  severity: number[]
  timeThresholdMinutes: number
  escalationActions: EscalationAction[]
  isActive: boolean
}

export interface EscalationAction {
  type: 'NOTIFY_ADMIN' | 'NOTIFY_VOLUNTEERS' | 'AUTO_ASSIGN' | 'SMS_ALERT' | 'EMAIL_ALERT'
  target: string
  message: string
  delayMinutes?: number
}

export interface EscalationEvent {
  incidentId: string
  ruleId: string
  triggeredAt: string
  actions: EscalationAction[]
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  completedActions: string[]
  failedActions: string[]
}

export class EscalationService {
  private static instance: EscalationService
  private supabaseAdmin: any
  private escalationTimer: NodeJS.Timeout | null = null

  constructor() {
    this.supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }

  static getInstance(): EscalationService {
    if (!EscalationService.instance) {
      EscalationService.instance = new EscalationService()
    }
    return EscalationService.instance
  }

  /**
   * Start the escalation monitoring service
   */
  startEscalationMonitoring(): void {
    if (this.escalationTimer) {
      clearInterval(this.escalationTimer)
    }

    // Check for escalations every 5 minutes
    this.escalationTimer = setInterval(async () => {
      await this.checkAndProcessEscalations()
    }, 5 * 60 * 1000)

    console.log('Escalation monitoring started')
  }

  /**
   * Stop the escalation monitoring service
   */
  stopEscalationMonitoring(): void {
    if (this.escalationTimer) {
      clearInterval(this.escalationTimer)
      this.escalationTimer = null
    }
    console.log('Escalation monitoring stopped')
  }

  /**
   * Check for incidents that need escalation
   */
  async checkAndProcessEscalations(): Promise<void> {
    try {
      console.log('Checking for escalations...')

      // Get all pending incidents
      const { data: pendingIncidents, error } = await this.supabaseAdmin
        .from('incidents')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching pending incidents:', error)
        return
      }

      if (!pendingIncidents || pendingIncidents.length === 0) {
        return
      }

      // Get escalation rules
      const rules = await this.getEscalationRules()

      for (const incident of pendingIncidents) {
        const minutesSinceCreation = this.getMinutesSinceCreation(incident.created_at)
        
        for (const rule of rules) {
          if (await this.shouldTriggerEscalation(incident, rule, minutesSinceCreation)) {
            await this.triggerEscalation(incident, rule)
          }
        }
      }
    } catch (error) {
      console.error('Error in escalation check:', error)
    }
  }

  /**
   * Get escalation rules from database
   */
  private async getEscalationRules(): Promise<EscalationRule[]> {
    try {
      // For now, return default rules. In production, these would be stored in database
      // NOTE: 5-minute threshold is aggressive and applies ONLY to critical incidents (severity 1-2)
      // Non-critical incidents use longer thresholds (30min for high, 60min for medium)
      // Confirm with stakeholders if 5 minutes is acceptable for critical incidents
      return [
        {
          id: 'critical-5min',
          name: 'Critical Incident - 5 Minutes',
          severity: [1, 2], // ONLY applies to critical/emergency incidents
          timeThresholdMinutes: 5, // ⚠️ AGGRESSIVE: Confirm with stakeholders
          escalationActions: [
            {
              type: 'NOTIFY_ADMIN',
              target: 'all',
              message: 'Critical incident unassigned for 5 minutes',
              delayMinutes: 0
            },
            {
              type: 'SMS_ALERT',
              target: 'admin',
              message: 'URGENT: Incident needs immediate attention',
              delayMinutes: 0
            },
            {
              type: 'AUTO_ASSIGN',
              target: 'any',
              message: 'Attempting automatic assignment',
              delayMinutes: 1
            }
          ],
          isActive: true
        },
        {
          id: 'high-30min',
          name: 'High Priority - 30 Minutes',
          severity: [3],
          timeThresholdMinutes: 30,
          escalationActions: [
            {
              type: 'NOTIFY_ADMIN',
              target: 'all',
              message: 'High priority incident unassigned for 30 minutes',
              delayMinutes: 0
            },
            {
              type: 'AUTO_ASSIGN',
              target: 'any',
              message: 'Attempting automatic assignment',
              delayMinutes: 5
            }
          ],
          isActive: true
        },
        {
          id: 'medium-60min',
          name: 'Medium Priority - 60 Minutes',
          severity: [4],
          timeThresholdMinutes: 60,
          escalationActions: [
            {
              type: 'NOTIFY_ADMIN',
              target: 'all',
              message: 'Medium priority incident unassigned for 60 minutes',
              delayMinutes: 0
            }
          ],
          isActive: true
        }
      ]
    } catch (error) {
      console.error('Error getting escalation rules:', error)
      return []
    }
  }

  /**
   * Check if escalation should be triggered
   */
  private async shouldTriggerEscalation(incident: any, rule: EscalationRule, minutesSinceCreation: number): Promise<boolean> {
    if (!rule.isActive) return false
    
    // Check if incident severity matches rule
    if (!rule.severity.includes(incident.severity || 3)) return false
    
    // Check if time threshold is met
    if (minutesSinceCreation < rule.timeThresholdMinutes) return false
    
    // Check if escalation was already triggered for this incident and rule
    return await this.hasEscalationBeenTriggered(incident.id, rule.id)
  }

  /**
   * Check if escalation has already been triggered
   */
  private async hasEscalationBeenTriggered(incidentId: string, ruleId: string): Promise<boolean> {
    try {
      const { data } = await this.supabaseAdmin
        .from('escalation_events')
        .select('id')
        .eq('incident_id', incidentId)
        .eq('rule_id', ruleId)
        .limit(1)

      return data && data.length > 0
    } catch (error) {
      console.error('Error checking escalation status:', error)
      return false
    }
  }

  /**
   * Trigger escalation for an incident
   */
  private async triggerEscalation(incident: any, rule: EscalationRule): Promise<void> {
    try {
      console.log(`Triggering escalation for incident ${incident.id} with rule ${rule.name}`)

      // Create escalation event
      const escalationEvent: EscalationEvent = {
        incidentId: incident.id,
        ruleId: rule.id,
        triggeredAt: new Date().toISOString(),
        actions: rule.escalationActions,
        status: 'PENDING',
        completedActions: [],
        failedActions: []
      }

      // Store escalation event
      await this.storeEscalationEvent(escalationEvent)

      // Log escalation to audit trail
      await this.supabaseAdmin.from('system_logs').insert({
        action: 'ESCALATION_TRIGGERED',
        details: JSON.stringify({
          incident_id: incident.id,
          incident_type: incident.incident_type,
          severity: incident.severity,
          rule_id: rule.id,
          rule_name: rule.name,
          threshold_minutes: rule.timeThresholdMinutes,
          triggered_at: escalationEvent.triggeredAt,
          barangay: incident.barangay
        }),
        user_id: null // System-triggered
      }).then(() => {}).catch((err: any) => {
        console.error('Failed to log escalation to audit trail:', err)
      })

      // Execute escalation actions
      await this.executeEscalationActions(incident, escalationEvent)

    } catch (error) {
      console.error('Error triggering escalation:', error)
      // Log escalation failure
      await this.supabaseAdmin.from('system_logs').insert({
        action: 'ESCALATION_FAILED',
        details: JSON.stringify({
          incident_id: incident.id,
          rule_id: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }),
        user_id: null
      }).catch(() => {})
    }
  }

  /**
   * Execute escalation actions
   */
  private async executeEscalationActions(incident: any, escalationEvent: EscalationEvent): Promise<void> {
    try {
      escalationEvent.status = 'IN_PROGRESS'
      await this.updateEscalationEvent(escalationEvent)

      for (const action of escalationEvent.actions) {
        try {
          await this.executeAction(incident, action)
          escalationEvent.completedActions.push(action.type)
        } catch (error) {
          console.error(`Failed to execute action ${action.type}:`, error)
          escalationEvent.failedActions.push(action.type)
        }
      }

      escalationEvent.status = escalationEvent.failedActions.length === 0 ? 'COMPLETED' : 'FAILED'
      await this.updateEscalationEvent(escalationEvent)

    } catch (error) {
      console.error('Error executing escalation actions:', error)
      escalationEvent.status = 'FAILED'
      await this.updateEscalationEvent(escalationEvent)
    }
  }

  /**
   * Execute a single escalation action
   */
  private async executeAction(incident: any, action: EscalationAction): Promise<void> {
    switch (action.type) {
      case 'NOTIFY_ADMIN':
        await this.notifyAdmins(incident, action.message)
        break
      
      case 'NOTIFY_VOLUNTEERS':
        await this.notifyVolunteers(incident, action.message)
        break
      
      case 'AUTO_ASSIGN':
        await this.attemptAutoAssignment(incident)
        break
      
      case 'SMS_ALERT':
        await this.sendSMSAlert(incident, action.message)
        break
      
      case 'EMAIL_ALERT':
        await this.sendEmailAlert(incident, action.message)
        break
      
      default:
        console.warn(`Unknown escalation action type: ${action.type}`)
    }
  }

  /**
   * Notify all admins
   */
  private async notifyAdmins(incident: any, message: string): Promise<void> {
    try {
      const { data: admins } = await this.supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'admin')

      if (!admins || admins.length === 0) return

      const adminIds = admins.map((admin: any) => admin.id)

      // Send push notifications
      const { data: subscriptions } = await this.supabaseAdmin
        .from('push_subscriptions')
        .select('subscription, user_id')
        .in('user_id', adminIds)

      if (subscriptions && subscriptions.length > 0) {
        const payload = {
          title: '🚨 Escalation Alert',
          body: message,
          data: {
            type: 'escalation',
            incident_id: incident.id,
            url: `/admin/incidents/${incident.id}`
          }
        }

        await Promise.allSettled(
          subscriptions.map((sub: any) => 
            fetch('/api/notifications/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: sub.subscription, payload })
            })
          )
        )
      }

      // Create notification records
      await this.supabaseAdmin.from('notifications').insert(
        adminIds.map((adminId: string) => ({
          user_id: adminId,
          title: '🚨 Escalation Alert',
          body: message,
          type: 'escalation',
          data: { incident_id: incident.id }
        }))
      )

    } catch (error) {
      console.error('Error notifying admins:', error)
      throw error
    }
  }

  /**
   * Notify available volunteers
   */
  private async notifyVolunteers(incident: any, message: string): Promise<void> {
    try {
      // Get available volunteers in the area
      const { data: volunteers } = await this.supabaseAdmin
        .from('volunteer_profiles')
        .select('volunteer_user_id')
        .eq('is_available', true)

      if (!volunteers || volunteers.length === 0) return

      const volunteerIds = volunteers.map((v: any) => v.volunteer_user_id)

      // Send notifications
      const { data: subscriptions } = await this.supabaseAdmin
        .from('push_subscriptions')
        .select('subscription, user_id')
        .in('user_id', volunteerIds)

      if (subscriptions && subscriptions.length > 0) {
        const payload = {
          title: '🚨 Volunteer Needed',
          body: message,
          data: {
            type: 'volunteer_request',
            incident_id: incident.id,
            url: `/volunteer/incidents/${incident.id}`
          }
        }

        await Promise.allSettled(
          subscriptions.map((sub: any) => 
            fetch('/api/notifications/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: sub.subscription, payload })
            })
          )
        )
      }

    } catch (error) {
      console.error('Error notifying volunteers:', error)
      throw error
    }
  }

  /**
   * Attempt automatic assignment
   */
  private async attemptAutoAssignment(incident: any): Promise<void> {
    try {
      const assignmentCriteria = {
        incidentId: incident.id,
        incidentType: incident.incident_type,
        location: {
          lat: incident.location_lat,
          lng: incident.location_lng
        },
        barangay: incident.barangay,
        severity: incident.severity || 3,
        requiredSkills: this.getRequiredSkillsForIncidentType(incident.incident_type)
      }

      const result = await autoAssignmentService.assignIncident(assignmentCriteria)
      
      if (result.success) {
        console.log(`Auto-assignment successful for incident ${incident.id}`)
      } else {
        console.log(`Auto-assignment failed for incident ${incident.id}: ${result.message}`)
      }
    } catch (error) {
      console.error('Error in auto-assignment:', error)
      throw error
    }
  }

  /**
   * Send SMS alert (placeholder - requires SMS service integration)
   */
  private async sendSMSAlert(incident: any, message: string): Promise<void> {
    try {
      // TODO: Integrate with SMS service (Twilio/Semaphore)
      console.log(`SMS Alert: ${message}`)
      
      // For now, just log the SMS alert
      await this.supabaseAdmin.from('escalation_logs').insert({
        incident_id: incident.id,
        action_type: 'SMS_ALERT',
        message,
        status: 'PENDING',
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error sending SMS alert:', error)
      throw error
    }
  }

  /**
   * Send email alert (placeholder - requires email service integration)
   */
  private async sendEmailAlert(incident: any, message: string): Promise<void> {
    try {
      // TODO: Integrate with email service
      console.log(`Email Alert: ${message}`)
      
      // For now, just log the email alert
      await this.supabaseAdmin.from('escalation_logs').insert({
        incident_id: incident.id,
        action_type: 'EMAIL_ALERT',
        message,
        status: 'PENDING',
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error sending email alert:', error)
      throw error
    }
  }

  /**
   * Get required skills for incident type
   */
  private getRequiredSkillsForIncidentType(incidentType: string): string[] {
    const skillMapping: Record<string, string[]> = {
      'FIRE': ['FIREFIGHTING', 'EMERGENCY RESPONSE'],
      'FLOOD': ['WATER RESCUE', 'EMERGENCY RESPONSE'],
      'EARTHQUAKE': ['SEARCH AND RESCUE', 'EMERGENCY RESPONSE'],
      'MEDICAL EMERGENCY': ['FIRST AID', 'MEDICAL PROFESSIONAL'],
      'CRIME': ['EMERGENCY RESPONSE', 'LEADERSHIP'],
      'TRAFFIC ACCIDENT': ['FIRST AID', 'EMERGENCY RESPONSE'],
      'FALLEN TREE': ['EMERGENCY RESPONSE'],
      'POWER OUTAGE': ['EMERGENCY RESPONSE'],
      'WATER OUTAGE': ['EMERGENCY RESPONSE'],
      'LANDSLIDE': ['SEARCH AND RESCUE', 'EMERGENCY RESPONSE'],
      'OTHER': ['EMERGENCY RESPONSE']
    }
    
    return skillMapping[incidentType] || ['EMERGENCY RESPONSE']
  }

  /**
   * Calculate minutes since incident creation
   */
  private getMinutesSinceCreation(createdAt: string): number {
    const created = new Date(createdAt)
    const now = new Date()
    return (now.getTime() - created.getTime()) / (1000 * 60)
  }

  /**
   * Store escalation event
   */
  private async storeEscalationEvent(event: EscalationEvent): Promise<void> {
    try {
      await this.supabaseAdmin.from('escalation_events').insert({
        incident_id: event.incidentId,
        rule_id: event.ruleId,
        triggered_at: event.triggeredAt,
        actions: event.actions,
        status: event.status,
        completed_actions: event.completedActions,
        failed_actions: event.failedActions
      })
    } catch (error) {
      console.error('Error storing escalation event:', error)
    }
  }

  /**
   * Update escalation event
   */
  private async updateEscalationEvent(event: EscalationEvent): Promise<void> {
    try {
      await this.supabaseAdmin
        .from('escalation_events')
        .update({
          status: event.status,
          completed_actions: event.completedActions,
          failed_actions: event.failedActions
        })
        .eq('incident_id', event.incidentId)
        .eq('rule_id', event.ruleId)
    } catch (error) {
      console.error('Error updating escalation event:', error)
    }
  }

  /**
   * Get escalation statistics
   */
  async getEscalationStats(): Promise<{
    totalEscalations: number
    pendingEscalations: number
    completedEscalations: number
    failedEscalations: number
  }> {
    try {
      const { data: events } = await this.supabaseAdmin
        .from('escalation_events')
        .select('status')

      if (!events) {
        return {
          totalEscalations: 0,
          pendingEscalations: 0,
          completedEscalations: 0,
          failedEscalations: 0
        }
      }

      return {
        totalEscalations: events.length,
        pendingEscalations: events.filter((e: any) => e.status === 'PENDING').length,
        completedEscalations: events.filter((e: any) => e.status === 'COMPLETED').length,
        failedEscalations: events.filter((e: any) => e.status === 'FAILED').length
      }
    } catch (error) {
      console.error('Error getting escalation stats:', error)
      return {
        totalEscalations: 0,
        pendingEscalations: 0,
        completedEscalations: 0,
        failedEscalations: 0
      }
    }
  }
}

// Export singleton instance
export const escalationService = EscalationService.getInstance()
