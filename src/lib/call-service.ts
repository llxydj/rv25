import { supabase } from './supabase'

export interface EmergencyContact {
  id: string
  name: string
  number: string
  type: 'emergency' | 'fire' | 'police' | 'medical' | 'disaster' | 'admin' | 'utility'
  priority: number
  description?: string
  isActive: boolean
  created_at: string
  updated_at: string
}

export interface CallLog {
  id: string
  user_id: string
  contact_id: string
  contact_name: string
  contact_number: string
  call_type: 'emergency' | 'incident' | 'volunteer' | 'reporter' | 'admin'
  incident_id?: string
  duration?: number
  status: 'initiated' | 'connected' | 'missed' | 'failed' | 'completed'
  notes?: string
  created_at: string
  updated_at?: string
}

export interface CallPreferences {
  user_id: string
  favorite_contacts: string[]
  auto_log_calls: boolean
  call_reminders: boolean
  emergency_shortcut: string
  created_at: string
  updated_at: string
}

export class CallService {
  private static instance: CallService
  private callLogs: CallLog[] = []
  private emergencyContacts: EmergencyContact[] = []
  private preferences: CallPreferences | null = null

  private constructor() {}

  public static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService()
    }
    return CallService.instance
  }

  /**
   * Initialize the call service
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      await this.loadEmergencyContacts()
      await this.loadCallPreferences(userId)
      await this.loadCallLogs(userId)
      return true
    } catch (error) {
      console.error('Failed to initialize call service:', error)
      return false
    }
  }

  /**
   * Load emergency contacts from database
   */
  private async loadEmergencyContacts(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true })

      if (error) throw error
      this.emergencyContacts = data || []
    } catch (error) {
      const err: any = error
      console.warn('Emergency contacts load warning:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
      })
      // Fallback to hardcoded contacts
      this.emergencyContacts = this.getDefaultEmergencyContacts()
    }
  }

  /**
   * Get default emergency contacts (fallback)
   */
  private getDefaultEmergencyContacts(): EmergencyContact[] {
    return [
      {
        id: 'emergency-911',
        name: 'Emergency Hotline',
        number: '911',
        type: 'emergency',
        priority: 1,
        description: 'National emergency hotline',
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'rvois-hotline',
        name: 'RVOIS Hotline',
        number: '09998064555',
        type: 'emergency',
        priority: 2,
        description: 'RVOIS emergency response',
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'fire-dept',
        name: 'Fire Department',
        number: '(034) 495-1234',
        type: 'fire',
        priority: 3,
        description: 'Talisay City Fire Department',
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'police-station',
        name: 'Police Station',
        number: '(034) 495-5678',
        type: 'police',
        priority: 4,
        description: 'Talisay City Police Station',
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'disaster-risk',
        name: 'City Disaster Risk Reduction',
        number: '(034) 495-9999',
        type: 'disaster',
        priority: 5,
        description: 'CDRRMO Talisay City',
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'health-office',
        name: 'City Health Office',
        number: '(034) 495-1111',
        type: 'medical',
        priority: 6,
        description: 'Talisay City Health Office',
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  }

  /**
   * Load call preferences for user
   */
  private async loadCallPreferences(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('call_preferences')
        .select('user_id, favorite_contacts, auto_log_calls, call_reminders, emergency_shortcut, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle() // avoid 406 when 0 rows

      if (error) throw error

      this.preferences = data ?? {
        user_id: userId,
        favorite_contacts: [],
        auto_log_calls: true,
        call_reminders: true,
        emergency_shortcut: '911',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    } catch (error) {
      const err: any = error
      console.warn('Call preferences load warning:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
      })
      this.preferences = {
        user_id: userId,
        favorite_contacts: [],
        auto_log_calls: true,
        call_reminders: true,
        emergency_shortcut: '911',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
  }

  /**
   * Load call logs for user
   */
  private async loadCallLogs(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      this.callLogs = data || []
    } catch (error) {
      const err: any = error
      console.warn('Call logs load warning:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
      })
      this.callLogs = []
    }
  }

  /**
   * Make a call and log it
   */
  async makeCall(
    contactId: string,
    callType: CallLog['call_type'],
    incidentId?: string,
    notes?: string
  ): Promise<{ success: boolean; message: string; callId?: string }> {
    try {
      const contact = this.emergencyContacts.find(c => c.id === contactId)
      if (!contact) {
        return { success: false, message: 'Contact not found' }
      }

      // Create call log entry (to be saved best-effort after initiating call)
      const callLog: Omit<CallLog, 'id'> = {
        user_id: this.preferences?.user_id || '',
        contact_id: contactId,
        contact_name: contact.name,
        contact_number: contact.number,
        call_type: callType,
        incident_id: incidentId,
        status: 'initiated',
        notes,
        created_at: new Date().toISOString()
      }

      // Initiate the call
      const cleanNumber = this.cleanPhoneNumber(contact.number)
      this.initiateTelLink(cleanNumber)

      // Save to database if auto-logging is enabled (best-effort, non-blocking of the call)
      let newId: string | undefined
      if (this.preferences?.auto_log_calls) {
        try {
          const { data, error } = await supabase
            .from('call_logs')
            .insert(callLog)
            .select()
            .single()
          if (error) throw error
          const insertedId = String((data as any).id)
          newId = insertedId
          const fullLog: CallLog = { id: insertedId, ...callLog }
          this.callLogs.unshift(fullLog)
        } catch (logErr) {
          console.error('Failed to log call after initiating tel link:', logErr)
        }
      }

      return { 
        success: true, 
        message: `Calling ${contact.name}...`,
        callId: newId
      }
    } catch (error: any) {
      console.error('Error making call:', error)
      return { success: false, message: error.message || 'Failed to make call' }
    }
  }

  /**
   * Make a call to a specific number
   */
  async makeCallToNumber(
    number: string,
    name: string,
    callType: CallLog['call_type'],
    incidentId?: string,
    notes?: string
  ): Promise<{ success: boolean; message: string; callId?: string }> {
    try {
      // Create call log entry (to be saved best-effort after initiating call)
      const callLog: Omit<CallLog, 'id'> = {
        user_id: this.preferences?.user_id || '',
        contact_id: 'custom',
        contact_name: name,
        contact_number: number,
        call_type: callType,
        incident_id: incidentId,
        status: 'initiated',
        notes,
        created_at: new Date().toISOString()
      }

      // Initiate the call
      const cleanNumber = this.cleanPhoneNumber(number)
      this.initiateTelLink(cleanNumber)

      // Save to database if auto-logging is enabled (best-effort, non-blocking of the call)
      let newId: string | undefined
      if (this.preferences?.auto_log_calls) {
        try {
          const { data, error } = await supabase
            .from('call_logs')
            .insert(callLog)
            .select()
            .single()
          if (error) throw error
          const insertedId = String((data as any).id)
          newId = insertedId
          const fullLog: CallLog = { id: insertedId, ...callLog }
          this.callLogs.unshift(fullLog)
        } catch (logErr) {
          console.error('Failed to log call after initiating tel link:', logErr)
        }
      }

      return { 
        success: true, 
        message: `Calling ${name}...`,
        callId: newId
      }
    } catch (error: any) {
      console.error('Error making call to number:', error)
      return { success: false, message: error.message || 'Failed to make call' }
    }
  }

  /**
   * Update call status
   */
  async updateCallStatus(
    callId: string,
    status: CallLog['status'],
    duration?: number,
    notes?: string
  ): Promise<boolean> {
    try {
      const updateData: Partial<CallLog> = {
        status,
        updated_at: new Date().toISOString()
      }

      if (duration !== undefined) updateData.duration = duration
      if (notes) updateData.notes = notes

      const { error } = await supabase
        .from('call_logs')
        .update(updateData)
        .eq('id', callId)

      if (error) throw error

      // Update local cache
      const index = this.callLogs.findIndex(log => log.id === callId)
      if (index !== -1) {
        this.callLogs[index] = { ...this.callLogs[index], ...updateData }
      }

      return true
    } catch (error) {
      console.error('Error updating call status:', error)
      return false
    }
  }

  /**
   * Get emergency contacts by type
   */
  getEmergencyContacts(type?: EmergencyContact['type']): EmergencyContact[] {
    if (type) {
      return this.emergencyContacts.filter(contact => contact.type === type)
    }
    return this.emergencyContacts
  }

  /**
   * Get favorite contacts
   */
  getFavoriteContacts(): EmergencyContact[] {
    if (!this.preferences?.favorite_contacts.length) return []
    
    return this.emergencyContacts.filter(contact => 
      this.preferences!.favorite_contacts.includes(contact.id)
    )
  }

  /**
   * Add contact to favorites
   */
  async addToFavorites(contactId: string): Promise<boolean> {
    try {
      if (!this.preferences) return false

      const favorites = [...this.preferences.favorite_contacts]
      if (!favorites.includes(contactId)) {
        favorites.push(contactId)
      }

      const { error } = await supabase
        .from('call_preferences')
        .upsert({
          ...this.preferences,
          favorite_contacts: favorites,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (error) throw error

      this.preferences.favorite_contacts = favorites
      return true
    } catch (error) {
      console.error('Error adding to favorites:', error)
      return false
    }
  }

  /**
   * Remove contact from favorites
   */
  async removeFromFavorites(contactId: string): Promise<boolean> {
    try {
      if (!this.preferences) return false

      const favorites = this.preferences.favorite_contacts.filter(id => id !== contactId)

      const { error } = await supabase
        .from('call_preferences')
        .upsert({
          ...this.preferences,
          favorite_contacts: favorites,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      this.preferences.favorite_contacts = favorites
      return true
    } catch (error) {
      console.error('Error removing from favorites:', error)
      return false
    }
  }

  /**
   * Get call logs
   */
  getCallLogs(limit?: number): CallLog[] {
    if (limit) {
      return this.callLogs.slice(0, limit)
    }
    return this.callLogs
  }

  /**
   * Get call statistics
   */
  getCallStatistics(): {
    totalCalls: number
    callsByType: Record<string, number>
    recentCalls: number
    averageDuration: number
  } {
    const totalCalls = this.callLogs.length
    const callsByType = this.callLogs.reduce((acc, log) => {
      acc[log.call_type] = (acc[log.call_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const recentCalls = this.callLogs.filter(log => {
      const callDate = new Date(log.created_at)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return callDate > oneWeekAgo
    }).length

    const completedCalls = this.callLogs.filter(log => log.status === 'completed' && log.duration)
    const averageDuration = completedCalls.length > 0 
      ? completedCalls.reduce((sum, log) => sum + (log.duration || 0), 0) / completedCalls.length
      : 0

    return {
      totalCalls,
      callsByType,
      recentCalls,
      averageDuration
    }
  }

  /**
   * Clean phone number for tel: links
   */
  private cleanPhoneNumber(number: string): string {
    // Remove all non-digit characters except + for international numbers
    return number.replace(/[^\d+]/g, '')
  }

  /**
   * Robustly initiate a tel: link on various browsers/platforms
   * Some browsers block window.open for tel: or require an actual anchor click from a user gesture.
   */
  private initiateTelLink(cleanNumber: string) {
    const telHref = `tel:${cleanNumber}`
    try {
      // Preferred: simulate a user click on an anchor element
      const anchor = document.createElement('a')
      anchor.setAttribute('href', telHref)
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      return
    } catch (_) {
      // ignore and try fallback
    }

    try {
      // Fallback: direct navigation
      window.location.href = telHref
      return
    } catch (_) {
      // ignore and try final fallback
    }

    try {
      // Last resort
      window.open(telHref, '_self')
    } catch (_) {
      // If everything fails, there's not much we can do programmatically
      // Consumers will already show a toast based on the returned result
    }
  }

  /**
   * Check if call service is supported
   */
  isSupported(): boolean {
    return 'navigator' in window && 'serviceWorker' in navigator
  }

  /**
   * Get call preferences
   */
  getPreferences(): CallPreferences | null {
    return this.preferences
  }

  /**
   * Update call preferences
   */
  async updatePreferences(updates: Partial<CallPreferences>): Promise<boolean> {
    try {
      if (!this.preferences) return false

      const updatedPreferences = {
        ...this.preferences,
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('call_preferences')
        .upsert(updatedPreferences, { onConflict: 'user_id' })

      if (error) throw error

      this.preferences = updatedPreferences
      return true
    } catch (error) {
      console.error('Error updating call preferences:', error)
      return false
    }
  }
}

// Export singleton instance
export const callService = CallService.getInstance()
