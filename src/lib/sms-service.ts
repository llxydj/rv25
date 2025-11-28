// src/lib/sms-service.ts

import { createClient } from '@supabase/supabase-js'

// SMS Service Types
export interface SMSTemplate {
  code: string
  name: string
  content: string
  variables: string[]
  isActive: boolean
}

export interface SMSLog {
  id: string
  incident_id: string
  reference_id: string
  trigger_source: string
  recipient_user_id: string
  phone_masked: string
  template_code: string
  message_content: string
  timestamp_sent: string
  api_response_status: string
  delivery_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY'
  retry_count: number
  error_message?: string
  api_response?: any
}

export interface SMSConfig {
  apiUrl: string
  apiKey: string
  sender: string
  rateLimitPerMinute: number
  rateLimitPerHour: number
  retryAttempts: number
  retryDelayMs: number
  isEnabled: boolean
}

export interface SMSDeliveryResult {
  success: boolean
  messageId?: string
  error?: string
  retryable: boolean
}

export class SMSService {
  private static instance: SMSService
  private supabaseAdmin: any
  private config: SMSConfig
  private rateLimitTracker: Map<string, number[]> = new Map()
  // Daily SMS limit protection
  private dailySMSCount: number = 0
  private dailyResetTime: number = Date.now() + (24 * 60 * 60 * 1000)
  private readonly dailySMSLimit: number = parseInt(process.env.SMS_DAILY_LIMIT || '1000')

  constructor() {
    this.supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Load SMS configuration from database with environment variable fallbacks
    this.config = {
      apiUrl: process.env.SMS_API_URL || 'https://sms.iprogtech.com/api/v1/sms_messages',
      apiKey: process.env.SMS_API_KEY || '',
      sender: process.env.SMS_SENDER || 'iprogtech',
      rateLimitPerMinute: parseInt(process.env.SMS_RATE_LIMIT_MINUTE || '10'),
      rateLimitPerHour: parseInt(process.env.SMS_RATE_LIMIT_HOUR || '100'),
      retryAttempts: parseInt(process.env.SMS_RETRY_ATTEMPTS || '1'),
      retryDelayMs: parseInt(process.env.SMS_RETRY_DELAY_MS || '5000'),
      isEnabled: (process.env.SMS_ENABLED || 'true').toLowerCase() === 'true'
    }

    console.log('📱 SMS Service Configuration Loaded:', {
      apiUrl: this.config.apiUrl,
      hasApiKey: !!this.config.apiKey,
      sender: this.config.sender,
      isEnabled: this.config.isEnabled
    })
    
    // Validate API key on startup (non-blocking)
    if (this.config.isEnabled && this.config.apiKey) {
      this.validateAPIKey().catch(err => {
        console.warn('⚠️ SMS API key validation failed (non-critical):', err.message)
      })
    } else if (this.config.isEnabled && !this.config.apiKey) {
      console.error('❌ SMS is enabled but API key is missing! SMS will not work.')
    }
  }
  
  /**
   * Validate SMS API key by checking API connectivity
   */
  private async validateAPIKey(): Promise<boolean> {
    try {
      // Try a simple API call to validate key
      // Most SMS APIs have a status/balance endpoint
      const testUrl = this.config.apiUrl.replace('/sms_messages', '/status')
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        // Timeout after 5 seconds
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        console.log('✅ SMS API key validated successfully')
        return true
      } else {
        console.warn('⚠️ SMS API key validation returned non-OK status:', response.status)
        return false
      }
    } catch (error: any) {
      // Don't fail if validation fails - API might not have status endpoint
      // Just log a warning
      if (error.name === 'AbortError') {
        console.warn('⚠️ SMS API validation timeout (API might not have status endpoint)')
      } else {
        console.warn('⚠️ SMS API validation failed (non-critical):', error.message)
      }
      return false
    }
  }

  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService()
    }
    return SMSService.instance
  }

  /**
   * Send SMS with template and variables
   */
  async sendSMS(
    phoneNumber: string,
    templateCode: string,
    variables: Record<string, string>,
    context: {
      incidentId: string
      referenceId: string
      triggerSource: string
      recipientUserId: string
    }
  ): Promise<SMSDeliveryResult> {
    try {
      // Check if SMS is enabled
      if (!this.config.isEnabled) {
        console.log('SMS service is disabled')
        return { success: false, error: 'SMS service disabled', retryable: false }
      }

      // Validate and normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber)
      if (!normalizedPhone) {
        return { success: false, error: 'Invalid phone number', retryable: false }
      }

      // Use the normalized phone number for all operations
      const smsPhoneNumber = normalizedPhone

      // Check rate limits
      if (!this.checkRateLimit(smsPhoneNumber)) {
        return { success: false, error: 'Rate limit exceeded', retryable: true }
      }

      // Check daily SMS limit (critical protection against subscription drain)
      if (!this.checkDailyLimit()) {
        console.error('🚨 Daily SMS limit exceeded! SMS sending blocked to protect subscription.')
        return { success: false, error: 'Daily SMS limit exceeded', retryable: false }
      }

      // Check for duplicate sends (cooldown)
      if (await this.isDuplicateSend(context.incidentId, context.triggerSource)) {
        console.log(`Duplicate SMS prevented for incident ${context.incidentId}, trigger ${context.triggerSource}`)
        return { success: false, error: 'Duplicate send prevented', retryable: false }
      }

      // Get template
      const template = await this.getTemplate(templateCode)
      if (!template) {
        return { success: false, error: 'Template not found', retryable: false }
      }

      // Render message
      const messageContent = this.renderTemplate(template.content, variables)
      
      // Create SMS log entry
      const smsLog = await this.createSMSLog({
        incident_id: context.incidentId,
        reference_id: context.referenceId,
        trigger_source: context.triggerSource,
        recipient_user_id: context.recipientUserId,
        phone_masked: this.maskPhoneNumber(smsPhoneNumber),
        template_code: templateCode,
        message_content: messageContent,
        timestamp_sent: new Date().toISOString(),
        api_response_status: 'PENDING',
        delivery_status: 'PENDING',
        retry_count: 0
      })

      // Send SMS via API using the normalized phone number
      const result = await this.sendViaAPI(smsPhoneNumber, messageContent)

      // Update log with result
      await this.updateSMSLog(smsLog.id, {
        api_response_status: result.success ? '200 OK' : 'ERROR',
        delivery_status: result.success ? 'SUCCESS' : 'FAILED',
        error_message: result.error,
        api_response: result
      })

      // Update rate limit tracker
      this.updateRateLimit(smsPhoneNumber)
      
      // Increment daily SMS count if successful
      if (result.success) {
        this.incrementDailyCount()
      }

      return result

    } catch (error: any) {
      console.error('SMS send error:', error)
      return {
        success: false,
        error: error.message || 'Unknown error',
        retryable: true
      }
    }
  }

  /**
   * Send SMS to multiple recipients
   */
  async sendBulkSMS(
    recipients: Array<{
      phoneNumber: string
      userId: string
    }>,
    templateCode: string,
    variables: Record<string, string>,
    context: {
      incidentId: string
      referenceId: string
      triggerSource: string
    }
  ): Promise<{
    success: boolean
    results: Array<{
      userId: string
      success: boolean
      error?: string
    }>
  }> {
    const results = await Promise.allSettled(
      recipients.map(recipient => 
        this.sendSMS(recipient.phoneNumber, templateCode, variables, {
          ...context,
          recipientUserId: recipient.userId
        })
      )
    )

    const processedResults = results.map((result, index) => ({
      userId: recipients[index].userId,
      success: result.status === 'fulfilled' && result.value.success,
      error: result.status === 'rejected' ? result.reason : 
             (result.status === 'fulfilled' ? result.value.error : 'Unknown error')
    }))

    const successCount = processedResults.filter(r => r.success).length

    return {
      success: successCount > 0,
      results: processedResults
    }
  }

  /**
   * Send incident confirmation to resident
   */
  async sendIncidentConfirmation(
    incidentId: string,
    referenceId: string,
    residentPhone: string,
    residentUserId: string,
    incidentData: {
      type: string
      barangay: string
      time: string
    }
  ): Promise<SMSDeliveryResult> {
    return this.sendSMS(
      residentPhone,
      'TEMPLATE_INCIDENT_CONFIRM',
      {
        ref: referenceId,
        type: incidentData.type,
        barangay: incidentData.barangay,
        time: incidentData.time
      },
      {
        incidentId,
        referenceId,
        triggerSource: 'Incident_Confirmed',
        recipientUserId: residentUserId
      }
    )
  }

  /**
   * Send volunteer status update notification to resident
   */
  async sendResidentStatusUpdate(
    incidentId: string,
    referenceId: string,
    residentPhone: string,
    residentUserId: string,
    statusData: {
      status: string
      volunteerName: string
      type: string
      barangay: string
      time: string
    }
  ): Promise<SMSDeliveryResult> {
    // Determine template based on status
    let templateCode = 'TEMPLATE_INCIDENT_STATUS_UPDATE';
    if (statusData.status === 'RESPONDING') {
      templateCode = 'TEMPLATE_VOLUNTEER_OTW';
    } else if (statusData.status === 'RESOLVED') {
      templateCode = 'TEMPLATE_INCIDENT_RESOLVED';
    }

    return this.sendSMS(
      residentPhone,
      templateCode,
      {
        ref: referenceId,
        volunteer: statusData.volunteerName,
        type: statusData.type,
        barangay: statusData.barangay,
        time: statusData.time
      },
      {
        incidentId,
        referenceId,
        triggerSource: `Resident_Status_Update_${statusData.status}`,
        recipientUserId: residentUserId
      }
    )
  }

  /**
   * Send volunteer status update notification to admins
   */
  async sendAdminStatusUpdate(
    incidentId: string,
    referenceId: string,
    adminPhones: string[],
    adminUserIds: string[],
    statusData: {
      status: string
      volunteerName: string
      incidentId: string
      type: string
      barangay: string
      time: string
    }
  ): Promise<{
    success: boolean
    results: Array<{ userId: string; success: boolean; error?: string }>
  }> {
    const recipients = adminPhones.map((phone, index) => ({
      phoneNumber: phone,
      userId: adminUserIds[index]
    }))

    // Determine template based on status
    let templateCode = 'TEMPLATE_ADMIN_INCIDENT_STATUS';
    if (statusData.status === 'RESPONDING') {
      templateCode = 'TEMPLATE_ADMIN_VOLUNTEER_OTW';
    } else if (statusData.status === 'RESOLVED') {
      templateCode = 'TEMPLATE_ADMIN_INCIDENT_RESOLVED';
    }

    return this.sendBulkSMS(
      recipients,
      templateCode,
      {
        ref: referenceId,
        volunteer: statusData.volunteerName,
        incident: statusData.incidentId.slice(0, 8),
        type: statusData.type,
        barangay: statusData.barangay,
        time: statusData.time
      },
      {
        incidentId,
        referenceId,
        triggerSource: `Admin_Status_Update_${statusData.status}`
      }
    )
  }

  /**
   * Send immediate volunteer assignment SMS
   */
  async sendVolunteerAssignment(
    incidentId: string,
    referenceId: string,
    volunteerPhone: string,
    volunteerUserId: string,
    incidentData: {
      type: string
      barangay: string
      time: string
    }
  ): Promise<SMSDeliveryResult> {
    return this.sendSMS(
      volunteerPhone,
      'TEMPLATE_INCIDENT_ASSIGN',
      {
        ref: referenceId,
        type: incidentData.type,
        barangay: incidentData.barangay,
        time: incidentData.time
      },
      {
        incidentId,
        referenceId,
        triggerSource: 'Volunteer_Assignment_Immediate',
        recipientUserId: volunteerUserId
      }
    )
  }

  /**
   * Send volunteer fallback alert (if push notification not acknowledged)
   */
  async sendVolunteerFallback(
    incidentId: string,
    referenceId: string,
    volunteerPhone: string,
    volunteerUserId: string,
    incidentData: {
      type: string
      barangay: string
      time: string
    }
  ): Promise<SMSDeliveryResult> {
    return this.sendSMS(
      volunteerPhone,
      'TEMPLATE_INCIDENT_ASSIGN',
      {
        ref: referenceId,
        type: incidentData.type,
        barangay: incidentData.barangay,
        time: incidentData.time
      },
      {
        incidentId,
        referenceId,
        triggerSource: 'Volunteer_Fallback',
        recipientUserId: volunteerUserId
      }
    )
  }

  /**
   * Send admin critical alert
   */
  async sendAdminCriticalAlert(
    incidentId: string,
    referenceId: string,
    adminPhones: string[],
    adminUserIds: string[],
    incidentData: {
      type: string
      barangay: string
      time: string
    }
  ): Promise<{
    success: boolean
    results: Array<{ userId: string; success: boolean; error?: string }>
  }> {
    const recipients = adminPhones.map((phone, index) => ({
      phoneNumber: phone,
      userId: adminUserIds[index]
    }))

    return this.sendBulkSMS(
      recipients,
      'TEMPLATE_ADMIN_CRITICAL',
      {
        ref: referenceId,
        type: incidentData.type,
        barangay: incidentData.barangay,
        time: incidentData.time
      },
      {
        incidentId,
        referenceId,
        triggerSource: 'Admin_Critical_Alert'
      }
    )
  }

  /**
   * Send barangay alert
   */
  async sendBarangayAlert(
    incidentId: string,
    referenceId: string,
    secretaryPhone: string,
    secretaryUserId: string,
    incidentData: {
      type: string
      barangay: string
      time: string
    }
  ): Promise<SMSDeliveryResult> {
    return this.sendSMS(
      secretaryPhone,
      'TEMPLATE_BARANGAY_ALERT',
      {
        ref: referenceId,
        type: incidentData.type,
        barangay: incidentData.barangay,
        time: incidentData.time
      },
      {
        incidentId,
        referenceId,
        triggerSource: 'Barangay_Alert',
        recipientUserId: secretaryUserId
      }
    )
  }

  // Private helper methods

  private async sendViaAPI(phoneNumber: string, message: string): Promise<SMSDeliveryResult> {
    try {
      // Validate configuration
      if (!this.config.apiKey) {
        return {
          success: false,
          error: 'SMS API key not configured',
          retryable: false
        }
      }

      // Prepare the API request
      const payload = new URLSearchParams({
        api_token: this.config.apiKey,
        sender: this.config.sender,
        number: phoneNumber,
        message: message
      })

      // Send the request with retry logic
      let lastError: any = null
      
      for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
        try {
          const response = await fetch(this.config.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: payload.toString(),
          })

          const responseText = await response.text()
          
          // Try to parse JSON response
          let responseData: any
          try {
            responseData = JSON.parse(responseText)
          } catch {
            // If not JSON, treat as plain text
            responseData = { message: responseText, success: response.status === 200 }
          }

          // Treat success responses and 'queued for delivery' as successful
          if (response.ok && (responseData.success || responseData.status === 'success' || 
              (typeof responseData.message === 'string' && responseData.message.toLowerCase().includes('queued for delivery')))) {
            return {
              success: true,
              messageId: responseData.message_id || responseData.id,
              retryable: false
            }
          } else {
            lastError = new Error(responseData.message || responseData.error || `HTTP ${response.status}: ${response.statusText}`)
            
            // If this is the last attempt, return the error
            if (attempt === this.config.retryAttempts) {
              return {
                success: false,
                error: lastError.message,
                retryable: response.status >= 500 || response.status === 429 // Retry on server errors or rate limits
              }
            }
          }
        } catch (error: unknown) {
          lastError = error
          
          // If this is the last attempt, return the error
          if (attempt === this.config.retryAttempts) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              retryable: true // Network errors are typically retryable
            }
          }
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      // This should never be reached, but just in case
      return {
        success: false,
        error: lastError?.message || 'Unknown error occurred',
        retryable: true
      }
    } catch (error: any) {
      console.error('SMS API error:', error)
      return {
        success: false,
        error: error.message || 'Failed to send SMS',
        retryable: true
      }
    }
  }

  private normalizePhoneNumber(phoneNumber: string): string | null {
    if (!phoneNumber) return null
    
    // Remove all non-digit characters except +
    let normalized = phoneNumber.replace(/[^\d+]/g, '')
    
    // Handle different formats
    if (normalized.startsWith('+63')) {
      normalized = '0' + normalized.substring(3)
    } else if (normalized.startsWith('63')) {
      normalized = '0' + normalized.substring(2)
    }
    
    // Validate Philippine mobile number format
    if (normalized.startsWith('09') && normalized.length === 11) {
      return normalized
    }
    
    // Invalid format
    return null
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return 'N/A'
    
    // Show only last 4 digits
    return phoneNumber.replace(/^(09\d{5})\d{3}(\d{3})$/, '$1***$2')
  }

  private async getTemplate(templateCode: string): Promise<SMSTemplate | null> {
    // First try to get from database
    try {
      const { data, error } = await this.supabaseAdmin
        .from('sms_templates')
        .select('*')
        .eq('code', templateCode)
        .eq('is_active', true)
        .single()

      if (!error && data) {
        return {
          code: data.code,
          name: data.name,
          content: data.content,
          variables: data.variables || [],
          isActive: data.is_active
        }
      }
    } catch (error) {
      console.error('Error fetching template from DB:', error)
    }

    // Fallback to default templates
    const defaultTemplates: Record<string, SMSTemplate> = {
      'TEMPLATE_INCIDENT_CONFIRM': {
        code: 'TEMPLATE_INCIDENT_CONFIRM',
        name: 'Incident Confirmation',
        content: '[RVOIS] Incident #{{ref}} reported: {{type}} in {{barangay}} at {{time}}. We are processing your report.',
        variables: ['ref', 'type', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_INCIDENT_ASSIGN': {
        code: 'TEMPLATE_INCIDENT_ASSIGN',
        name: 'Incident Assignment',
        content: '[RVOIS] You are assigned to incident #{{ref}}: {{type}} in {{barangay}}. Please respond immediately.',
        variables: ['ref', 'type', 'barangay'],
        isActive: true
      },
      'TEMPLATE_VOLUNTEER_OTW': {
        code: 'TEMPLATE_VOLUNTEER_OTW',
        name: 'Volunteer On The Way',
        content: '[RVOIS] Volunteer {{volunteer}} is on the way to your incident #{{ref}} in {{barangay}} | {{time}}',
        variables: ['ref', 'volunteer', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_INCIDENT_RESOLVED': {
        code: 'TEMPLATE_INCIDENT_RESOLVED',
        name: 'Incident Resolved',
        content: '[RVOIS] Incident #{{ref}} has been resolved by {{volunteer}} in {{barangay}} | {{time}}. Thank you for your report.',
        variables: ['ref', 'volunteer', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_INCIDENT_STATUS_UPDATE': {
        code: 'TEMPLATE_INCIDENT_STATUS_UPDATE',
        name: 'Incident Status Update',
        content: '[RVOIS] Status update for incident #{{ref}}: {{status}} by {{volunteer}} in {{barangay}} | {{time}}',
        variables: ['ref', 'status', 'volunteer', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_ADMIN_CRITICAL': {
        code: 'TEMPLATE_ADMIN_CRITICAL',
        name: 'Admin Critical Alert',
        content: '[RVOIS ADMIN] 🔴 CRITICAL: New {{type}} incident #{{ref}} reported in {{barangay}} | {{time}}',
        variables: ['ref', 'type', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_ADMIN_INCIDENT_STATUS': {
        code: 'TEMPLATE_ADMIN_INCIDENT_STATUS',
        name: 'Admin Incident Status',
        content: '[RVOIS ADMIN] Status changed for incident {{incident}}: {{status}} by {{volunteer}} in {{barangay}} | {{time}}',
        variables: ['incident', 'status', 'volunteer', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_ADMIN_VOLUNTEER_OTW': {
        code: 'TEMPLATE_ADMIN_VOLUNTEER_OTW',
        name: 'Admin Volunteer OTW',
        content: '[RVOIS ADMIN] Volunteer {{volunteer}} responding to incident #{{ref}} in {{barangay}} | {{time}}',
        variables: ['ref', 'volunteer', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_ADMIN_INCIDENT_RESOLVED': {
        code: 'TEMPLATE_ADMIN_INCIDENT_RESOLVED',
        name: 'Admin Incident Resolved',
        content: '[RVOIS ADMIN] Incident {{incident}} resolved by {{volunteer}} in {{barangay}} | {{time}}',
        variables: ['incident', 'volunteer', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_BARANGAY_ALERT': {
        code: 'TEMPLATE_BARANGAY_ALERT',
        name: 'Barangay Alert',
        content: '[RVOIS BARANGAY] 🔴 URGENT: {{type}} incident #{{ref}} reported in {{barangay}} | {{time}}. Please coordinate response.',
        variables: ['ref', 'type', 'barangay', 'time'],
        isActive: true
      },
      'TEMPLATE_SCHEDULE_ASSIGN': {
        code: 'TEMPLATE_SCHEDULE_ASSIGN',
        name: 'Schedule Assignment',
        content: '[RVOIS] 📅 New Activity: {{title}} on {{date}} at {{time}}{{location}}. Please accept or decline in the app.',
        variables: ['title', 'date', 'time', 'location'],
        isActive: true
      },
      'TEMPLATE_TRAINING_NOTIFY': {
        code: 'TEMPLATE_TRAINING_NOTIFY',
        name: 'Training Notification',
        content: '[RVOIS] 🎓 Training: {{title}} on {{date}} at {{time}}{{location}}. Check the app for details.',
        variables: ['title', 'date', 'time', 'location'],
        isActive: true
      }
    }

    return defaultTemplates[templateCode] || null
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value)
    })
    
    return rendered
  }

  private checkRateLimit(phoneNumber: string): boolean {
    const now = Date.now()
    const minuteAgo = now - 60 * 1000
    const hourAgo = now - 60 * 60 * 1000

    const timestamps = this.rateLimitTracker.get(phoneNumber) || []
    
    // Remove old timestamps
    const recentTimestamps = timestamps.filter(timestamp => timestamp > minuteAgo)
    const hourlyTimestamps = timestamps.filter(timestamp => timestamp > hourAgo)

    // Check limits
    if (recentTimestamps.length >= this.config.rateLimitPerMinute) {
      return false
    }
    
    if (hourlyTimestamps.length >= this.config.rateLimitPerHour) {
      return false
    }

    return true
  }

  private updateRateLimit(phoneNumber: string): void {
    const now = Date.now()
    const timestamps = this.rateLimitTracker.get(phoneNumber) || []
    timestamps.push(now)
    
    // Keep only last hour of timestamps
    const hourAgo = now - 60 * 60 * 1000
    const recentTimestamps = timestamps.filter(timestamp => timestamp > hourAgo)
    
    this.rateLimitTracker.set(phoneNumber, recentTimestamps)
  }

  private async isDuplicateSend(incidentId: string, triggerSource: string): Promise<boolean> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { data, error } = await this.supabaseAdmin
        .from('sms_logs')
        .select('id')
        .eq('incident_id', incidentId)
        .eq('trigger_source', triggerSource)
        .gte('timestamp_sent', fiveMinutesAgo)
        .limit(1)

      return !error && data && data.length > 0
    } catch (error) {
      console.error('Error checking duplicate send:', error)
      return false
    }
  }

  private async createSMSLog(logData: Partial<SMSLog>): Promise<SMSLog> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('sms_logs')
        .insert(logData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating SMS log:', error)
      throw error
    }
  }

  private async updateSMSLog(logId: string, updates: Partial<SMSLog>): Promise<void> {
    try {
      const { error } = await this.supabaseAdmin
        .from('sms_logs')
        .update(updates)
        .eq('id', logId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating SMS log:', error)
    }
  }

  /**
   * Get SMS delivery statistics
   */
  async getSMSStats(): Promise<{
    totalSent: number
    successRate: number
    failureRate: number
    recentActivity: Array<{
      date: string
      sent: number
      success: number
      failed: number
    }>
  }> {
    try {
      const { data: logs } = await this.supabaseAdmin
        .from('sms_logs')
        .select('delivery_status, timestamp_sent')
        .gte('timestamp_sent', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (!logs) {
        return {
          totalSent: 0,
          successRate: 0,
          failureRate: 0,
          recentActivity: []
        }
      }

      const totalSent = logs.length
      const successCount = logs.filter((log: any) => log.delivery_status === 'SUCCESS').length
      const failureCount = logs.filter((log: any) => log.delivery_status === 'FAILED').length

      return {
        totalSent,
        successRate: totalSent > 0 ? (successCount / totalSent) * 100 : 0,
        failureRate: totalSent > 0 ? (failureCount / totalSent) * 100 : 0,
        recentActivity: this.groupLogsByDate(logs)
      }
    } catch (error) {
      console.error('Error getting SMS stats:', error)
      return {
        totalSent: 0,
        successRate: 0,
        failureRate: 0,
        recentActivity: []
      }
    }
  }

  private groupLogsByDate(logs: any[]): Array<{
    date: string
    sent: number
    success: number
    failed: number
  }> {
    const grouped = logs.reduce((acc, log) => {
      const date = log.timestamp_sent.split('T')[0]
      if (!acc[date]) {
        acc[date] = { sent: 0, success: 0, failed: 0 }
      }
      acc[date].sent++
      if (log.delivery_status === 'SUCCESS') acc[date].success++
      if (log.delivery_status === 'FAILED') acc[date].failed++
      return acc
    }, {})

    return Object.entries(grouped).map(([date, stats]: [string, any]) => ({
      date,
      ...stats
    })).sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Retry failed SMS sends
   */
  async retryFailedSMS(): Promise<{
    success: boolean
    retried: number
    results: Array<{ logId: string; success: boolean; error?: string }>
  }> {
    try {
      const { data: failedLogs } = await this.supabaseAdmin
        .from('sms_logs')
        .select('*')
        .eq('delivery_status', 'FAILED')
        .lt('retry_count', this.config.retryAttempts)
        .gte('timestamp_sent', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .limit(10) // Limit retries

      if (!failedLogs || failedLogs.length === 0) {
        return { success: true, retried: 0, results: [] }
      }

      const results = await Promise.allSettled(
        failedLogs.map(async (log: any) => {
          try {
            // Get actual phone number from user record
            const phoneNumber = await this.unmaskPhoneNumber(log.phone_masked, log.recipient_user_id)
            
            if (!phoneNumber) {
              return { logId: log.id, success: false, error: 'Could not retrieve phone number' }
            }
            
            const result = await this.sendViaAPI(
              phoneNumber,
              log.message_content
            )

            await this.updateSMSLog(log.id, {
              delivery_status: result.success ? 'SUCCESS' : 'FAILED',
              retry_count: log.retry_count + 1,
              error_message: result.error,
              api_response: result
            })

            return { logId: log.id, success: result.success, error: result.error }
          } catch (error: any) {
            return { logId: log.id, success: false, error: error.message }
          }
        })
      )

      const processedResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : 
        { logId: 'unknown', success: false, error: 'Unknown error' }
      )

      const successCount = processedResults.filter(r => r.success).length

      return {
        success: successCount > 0,
        retried: failedLogs.length,
        results: processedResults
      }
    } catch (error) {
      console.error('Error retrying failed SMS:', error)
      return { success: false, retried: 0, results: [] }
    }
  }

  /**
   * Check daily SMS limit to prevent subscription drain
   */
  private checkDailyLimit(): boolean {
    const now = Date.now()
    
    // Reset daily count if 24 hours have passed
    if (now > this.dailyResetTime) {
      console.log(`📊 Daily SMS limit reset. Previous count: ${this.dailySMSCount}`)
      this.dailySMSCount = 0
      this.dailyResetTime = now + (24 * 60 * 60 * 1000)
    }
    
    // Check if limit exceeded
    if (this.dailySMSCount >= this.dailySMSLimit) {
      console.error(`🚨 Daily SMS limit exceeded: ${this.dailySMSCount}/${this.dailySMSLimit}`)
      return false
    }
    
    return true
  }

  /**
   * Increment daily SMS count
   */
  private incrementDailyCount(): void {
    this.dailySMSCount++
    
    // Log warning when approaching limit
    const percentage = (this.dailySMSCount / this.dailySMSLimit) * 100
    if (percentage >= 80 && percentage < 100) {
      console.warn(`⚠️ Daily SMS limit warning: ${this.dailySMSCount}/${this.dailySMSLimit} (${percentage.toFixed(1)}%)`)
    }
    
    if (percentage >= 100) {
      console.error(`🚨 Daily SMS limit reached: ${this.dailySMSCount}/${this.dailySMSLimit}`)
    }
  }

  /**
   * Get current daily SMS count and limit
   */
  getDailySMSStats(): { count: number; limit: number; percentage: number; resetTime: Date } {
    return {
      count: this.dailySMSCount,
      limit: this.dailySMSLimit,
      percentage: (this.dailySMSCount / this.dailySMSLimit) * 100,
      resetTime: new Date(this.dailyResetTime)
    }
  }

  private async unmaskPhoneNumber(maskedPhone: string, userId: string): Promise<string | null> {
    try {
      // Fetch actual phone number from user record
      const { data: user, error } = await this.supabaseAdmin
        .from('users')
        .select('phone_number')
        .eq('id', userId)
        .single()
      
      if (error || !user) {
        console.error('Error fetching phone number for retry:', error)
        return null
      }
      
      return user.phone_number || null
    } catch (error) {
      console.error('Error unmasking phone number:', error)
      return null
    }
  }
}

// Export singleton instance
export const smsService = SMSService.getInstance()
