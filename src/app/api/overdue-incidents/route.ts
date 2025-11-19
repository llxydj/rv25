import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type OverdueIncident = {
  id: string
  incident_type: string
  barangay: string
  priority: number
  minutes_since_last_update?: number
  minutes_since_creation?: number
  created_at: string
}

type AdminUser = {
  id: string
  phone_number: string | null
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Check for overdue incidents and send alerts
export async function GET(request: Request) {
  try {
    // Get overdue incidents that haven't been alerted about yet
    const { data: overdueIncidents, error } = await supabase
      .from('overdue_incidents')
      .select('*')
    
    if (error) throw error
    
    if (!overdueIncidents || overdueIncidents.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No overdue incidents found',
        count: 0 
      })
    }
    
    // For each overdue incident, send alerts to admins
    const alertsSent = []
    
    for (const incident of overdueIncidents) {
      try {
        // Get admin users to notify
        const { data: admins, error: adminError } = await supabase
          .from('users')
          .select('id, phone_number')
          .eq('role', 'admin')
        
        if (adminError) throw adminError
        
        if (admins && admins.length > 0) {
          // Create notification for each admin
          for (const admin of admins) {
            const { error: notificationError } = await supabase
              .from('notifications')
              .insert({
                user_id: admin.id,
                title: 'Overdue Incident Alert',
                body: `Incident #${incident.id.substring(0, 8)} (${incident.incident_type}) in ${incident.barangay} has not been updated in ${Math.floor(incident.minutes_since_last_update || incident.minutes_since_creation)} minutes.`,
                type: 'SYSTEM_ALERT',
                data: {
                  incident_id: incident.id,
                  type: 'overdue_incident'
                }
              })
            
            if (notificationError) {
              console.error('Failed to create notification for admin:', admin.id, notificationError)
            }
          }
          
          // Send SMS alerts to admins for priority 1 incidents overdue by 5+ minutes
          if (incident.priority === 1 && (incident.minutes_since_last_update >= 5 || incident.minutes_since_creation >= 5)) {
            const { smsService } = await import('@/lib/sms-service')
            
            // Get admin phone numbers
            const adminPhones = admins.filter((admin: AdminUser) => admin.phone_number).map((admin: AdminUser) => admin.phone_number) as string[]
            const adminUserIds = admins.filter((admin: AdminUser) => admin.phone_number).map((admin: AdminUser) => admin.id)
            
            if (adminPhones.length > 0) {
              await smsService.sendAdminCriticalAlert(
                incident.id,
                incident.id.substring(0, 8),
                adminPhones,
                adminUserIds,
                {
                  type: incident.incident_type,
                  barangay: incident.barangay,
                  time: new Date().toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })
                }
              )
            }
          }
          
          alertsSent.push(incident.id)
        }
      } catch (incidentError) {
        console.error('Error processing overdue incident:', incident.id, incidentError)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Processed ${overdueIncidents.length} overdue incidents`,
      count: overdueIncidents.length,
      alertsSent
    })
    
  } catch (error: any) {
    console.error('Error checking overdue incidents:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to check overdue incidents' 
    }, { status: 500 })
  }
}

// Manual trigger for testing and scheduled execution
export async function POST(request: Request) {
  try {
    // Get all overdue incidents (regardless of whether they've been alerted)
    const { data: overdueIncidents, error } = await supabase
      .from('incidents')
      .select('id, incident_type, barangay, status, created_at, priority')
      .eq('is_overdue', true)
    
    if (error) throw error
    
    if (!overdueIncidents || overdueIncidents.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No overdue incidents found',
        count: 0 
      })
    }
    
    // Send alerts for all overdue incidents
    const alertsSent = []
    
    for (const incident of overdueIncidents) {
      try {
        // Get admin users to notify
        const { data: admins, error: adminError } = await supabase
          .from('users')
          .select('id, phone_number')
          .eq('role', 'admin')
        
        if (adminError) throw adminError
        
        if (admins && admins.length > 0) {
          // Calculate minutes overdue
          const minutesOverdue = Math.floor(
            (new Date().getTime() - new Date(incident.created_at).getTime()) / 60000
          )
          
          // Check if this is a high-priority incident (priority 1) that's overdue by 5 minutes
          let alertTitle = 'Overdue Incident Alert'
          let alertBody = `Incident #${incident.id.substring(0, 8)} (${incident.incident_type}) in ${incident.barangay} has been overdue for ${minutesOverdue} minutes.`
          
          // For priority 1 incidents, add special handling if overdue by 5+ minutes
          if (incident.priority === 1 && minutesOverdue >= 5) {
            alertTitle = '🚨 CRITICAL: 5-Minute Response Time Exceeded!'
            alertBody = `🚨 CRITICAL INCIDENT #${incident.id.substring(0, 8)} (${incident.incident_type}) in ${incident.barangay} requires IMMEDIATE attention! Response time exceeded 5 minutes (${minutesOverdue} minutes overdue). Please assign volunteer immediately!`
          }
          
          // Create notification for each admin
          for (const admin of admins) {
            const { error: notificationError } = await supabase
              .from('notifications')
              .insert({
                user_id: admin.id,
                title: alertTitle,
                body: alertBody,
                type: 'SYSTEM_ALERT',
                data: {
                  incident_id: incident.id,
                  type: 'overdue_incident',
                  priority: incident.priority,
                  minutes_overdue: minutesOverdue
                }
              })
            
            if (notificationError) {
              console.error('Failed to create notification for admin:', admin.id, notificationError)
            }
          }
          
          // Send SMS alerts to admins for priority 1 incidents overdue by 5+ minutes
          if (incident.priority === 1 && minutesOverdue >= 5) {
            const { smsService } = await import('@/lib/sms-service')
            
            // Get admin phone numbers
            const adminPhones = admins.filter((admin: AdminUser) => admin.phone_number).map((admin: AdminUser) => admin.phone_number) as string[]
            const adminUserIds = admins.filter((admin: AdminUser) => admin.phone_number).map((admin: AdminUser) => admin.id)
            
            if (adminPhones.length > 0) {
              await smsService.sendAdminCriticalAlert(
                incident.id,
                incident.id.substring(0, 8),
                adminPhones,
                adminUserIds,
                {
                  type: incident.incident_type,
                  barangay: incident.barangay,
                  time: new Date().toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })
                }
              )
            }
          }
          
          alertsSent.push(incident.id)
        }
      } catch (incidentError) {
        console.error('Error processing overdue incident:', incident.id, incidentError)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Processed ${overdueIncidents.length} overdue incidents`,
      count: overdueIncidents.length,
      alertsSent
    })
    
  } catch (error: any) {
    console.error('Error checking overdue incidents:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to check overdue incidents' 
    }, { status: 500 })
  }
}