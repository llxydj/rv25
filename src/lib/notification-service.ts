/**
 * Centralized Notification Service
 * 
 * Purpose: Single source of truth for creating, broadcasting, and managing notifications
 * Benefits:
 * - Ensures consistent notification format
 * - Handles role-based targeting automatically
 * - Prevents silent failures
 * - Centralizes notification logic
 * - Works alongside database triggers
 */

import { createClient } from '@supabase/supabase-js'

// Use service role for bypassing RLS when creating notifications
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export interface NotificationData {
  incident_id?: string
  url?: string
  status?: string
  [key: string]: any
}

export interface CreateNotificationParams {
  title: string
  body: string
  type: string
  data?: NotificationData
}

/**
 * Core notification creation - used by both service and triggers
 */
async function checkUserNotificationPreferences(
  userId: string,
  notificationType: string
): Promise<boolean> {
  try {
    // Get user preferences
    const { data: preferences, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // If no preferences found, default to enabled
      return true
    }

    // Check if push notifications are enabled
    if (!preferences.push_enabled) {
      return false
    }

    // Check specific notification type
    switch (notificationType) {
      case 'incident_alert':
        return preferences.incident_alerts !== false
      case 'status_update':
        return preferences.status_updates !== false
      case 'escalation_alert':
        return preferences.escalation_alerts !== false
      case 'training_reminder':
        return preferences.training_reminders !== false
      case 'assignment_alert':
        return preferences.incident_alerts !== false
      default:
        return true
    }
  } catch (error) {
    console.error('Error checking notification preferences:', error)
    // Default to enabled if error
    return true
  }
}

async function createNotification(
  userId: string,
  params: CreateNotificationParams
) {
  const { title, body, type, data } = params

  // Check if user has notifications enabled for this type
  const isEnabled = await checkUserNotificationPreferences(userId, type)
  if (!isEnabled) {
    console.log(`Notifications disabled for user ${userId}, skipping notification`)
    return
  }

  const { error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      body,
      type,
      data: data || null,
    })

  if (error) {
    console.error('Failed to create notification:', error)
    throw error
  }
}

/**
 * Notification Service Class
 */
export class NotificationService {
  /**
   * Notify all admin users
   */
  static async notifyAdmins(params: CreateNotificationParams): Promise<void> {
    try {
      // Get all admin users with their notification preferences
      const { data: admins, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'admin')

      if (error) throw error
      if (!admins || admins.length === 0) {
        console.warn('No admin users found to notify')
        return
      }

      // Create notifications for all admins in parallel
      await Promise.allSettled(
        admins.map((admin) => createNotification(admin.id, params))
      )

      console.log(`✅ Notified ${admins.length} admin(s)`)
    } catch (error) {
      console.error('Failed to notify admins:', error)
      // Don't throw - notification failures shouldn't break main flow
    }
  }

  /**
   * Notify barangay staff for specific barangay
   */
  static async notifyBarangayStaff(
    barangay: string,
    params: CreateNotificationParams
  ): Promise<void> {
    try {
      const { data: staff, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'barangay')
        .ilike('barangay', barangay)

      if (error) throw error
      if (!staff || staff.length === 0) {
        console.warn(`No barangay staff found for ${barangay}`)
        return
      }

      await Promise.allSettled(
        staff.map((member) => createNotification(member.id, params))
      )

      console.log(`✅ Notified ${staff.length} barangay staff in ${barangay}`)
    } catch (error) {
      console.error('Failed to notify barangay staff:', error)
    }
  }

  /**
   * Notify specific volunteer
   */
  static async notifyVolunteer(
    volunteerId: string,
    params: CreateNotificationParams
  ): Promise<void> {
    try {
      await createNotification(volunteerId, params)
      console.log(`✅ Notified volunteer ${volunteerId}`)
    } catch (error) {
      console.error('Failed to notify volunteer:', error)
    }
  }

  /**
   * Notify specific resident
   */
  static async notifyResident(
    residentId: string,
    params: CreateNotificationParams
  ): Promise<void> {
    try {
      await createNotification(residentId, params)
      console.log(`✅ Notified resident ${residentId}`)
    } catch (error) {
      console.error('Failed to notify resident:', error)
    }
  }

  /**
   * Notify all volunteers (e.g., for training announcements)
   */
  static async notifyAllVolunteers(
    params: CreateNotificationParams
  ): Promise<void> {
    try {
      const { data: volunteers, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'volunteer')

      if (error) throw error
      if (!volunteers || volunteers.length === 0) {
        console.warn('No volunteers found to notify')
        return
      }

      await Promise.allSettled(
        volunteers.map((volunteer) => createNotification(volunteer.id, params))
      )

      console.log(`✅ Notified ${volunteers.length} volunteer(s)`)
    } catch (error) {
      console.error('Failed to notify all volunteers:', error)
    }
  }

  /**
   * Notify all users (system-wide broadcast)
   */
  static async notifyAllUsers(params: CreateNotificationParams): Promise<void> {
    try {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id')

      if (error) throw error
      if (!users || users.length === 0) {
        console.warn('No users found to notify')
        return
      }

      await Promise.allSettled(
        users.map((user) => createNotification(user.id, params))
      )

      console.log(`✅ Notified ${users.length} user(s)`)
    } catch (error) {
      console.error('Failed to notify all users:', error)
    }
  }

  /**
   * Helper: Notify on new incident
   * Called by API when database trigger is not available
   */
  static async onIncidentCreated(incident: {
    id: string
    incident_type: string
    barangay: string
    reporter_id: string
  }): Promise<void> {
    const { id, incident_type, barangay } = incident

    // Notify admins
    await this.notifyAdmins({
      title: '🚨 New Incident Reported',
      body: `${incident_type} in ${barangay}`,
      type: 'incident_alert',
      data: { incident_id: id, url: `/admin/incidents/${id}` },
    })

    // Notify barangay staff
    await this.notifyBarangayStaff(barangay, {
      title: '🚨 New Incident in Your Barangay',
      body: `${incident_type} reported in ${barangay}`,
      type: 'incident_alert',
      data: { incident_id: id, url: `/barangay/dashboard?incident=${id}` },
    })
  }

  /**
   * Helper: Notify on volunteer assignment
   */
  static async onVolunteerAssigned(
    volunteerId: string,
    incident: {
      id: string
      incident_type: string
      barangay: string
    }
  ): Promise<void> {
    await this.notifyVolunteer(volunteerId, {
      title: '📋 New Incident Assignment',
      body: `You have been assigned to a ${incident.incident_type} in ${incident.barangay}`,
      type: 'assignment_alert',
      data: { incident_id: incident.id, url: `/volunteer/incident/${incident.id}` },
    })
  }

  /**
   * Helper: Notify on status change
   */
  static async onIncidentStatusChanged(
    residentId: string,
    incident: {
      id: string
      status: string
    }
  ): Promise<void> {
    const statusMessages: Record<string, string> = {
      ASSIGNED: 'Your incident has been assigned to a volunteer',
      RESPONDING: 'A volunteer is responding to your incident',
      RESOLVED: 'Your incident has been resolved',
      CANCELLED: 'Your incident has been cancelled',
    }

    const message = statusMessages[incident.status] || `Your incident status has been updated to ${incident.status}`

    await this.notifyResident(residentId, {
      title: '📋 Incident Status Update',
      body: message,
      type: 'status_update',
      data: { 
        incident_id: incident.id, 
        status: incident.status,
        url: `/resident/history?incident=${incident.id}` 
      },
    })
  }

  /**
   * Helper: Notify on escalation
   */
  static async onIncidentEscalated(incident: {
    id: string
    incident_type: string
    barangay: string
    severity: number
  }): Promise<void> {
    const severityText = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'][incident.severity - 1] || 'UNKNOWN'

    await this.notifyAdmins({
      title: '⚠️ Incident Escalated',
      body: `${incident.incident_type} in ${incident.barangay} has been escalated to ${severityText}`,
      type: 'escalation_alert',
      data: { incident_id: incident.id, url: `/admin/incidents/${incident.id}` },
    })
  }
}

// Export singleton instance
export const notificationService = NotificationService
