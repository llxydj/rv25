import type { SupabaseClient } from '@supabase/supabase-js'

// Maps a notification type to a preference column in notification_preferences
export function mapTypeToPreference(type: string): keyof Pick<NotificationPrefs,'incident_alerts'|'status_updates'|'training_reminders'> | null {
  switch (type) {
    case 'incident_created':
    case 'incident_updated':
    case 'incident_escalated':
    case 'incident_alert':
      return 'incident_alerts'
    case 'status_update':
      return 'status_updates'
    case 'schedule_created':
    case 'training_reminder':
      return 'training_reminders'
    default:
      return null
  }
}

type NotificationPrefs = {
  push: boolean
  incident_alerts: boolean | null
  status_updates: boolean | null
  training_reminders: boolean | null
}

// Backward compatible: if no prefs row, allow notifications
export async function shouldNotify(supabase: SupabaseClient, userId: string, type: string): Promise<boolean> {
  const prefKey = mapTypeToPreference(type)
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('push, incident_alerts, status_updates, training_reminders')
      .eq('user_id', userId)
      .single()

    if (error || !data) return true
    const prefs = data as NotificationPrefs
    if (prefs.push === false) return false
    if (!prefKey) return true
    const val = prefs[prefKey]
    return val !== false
  } catch {
    return true
  }
}
