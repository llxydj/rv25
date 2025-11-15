export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          first_name: string
          last_name: string
          role: "admin" | "volunteer" | "resident" | "barangay"
          phone_number: string | null
          address: string | null
          barangay: string | null
          city: string
          province: string
          confirmation_phrase: string | null
          last_active: string
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          first_name: string
          last_name: string
          role: "admin" | "volunteer" | "resident" | "barangay"
          phone_number?: string | null
          address?: string | null
          barangay?: string | null
          city?: string
          province?: string
          confirmation_phrase?: string | null
          last_active?: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string
          first_name?: string
          last_name?: string
          role?: "admin" | "volunteer" | "resident" | "barangay"
          phone_number?: string | null
          address?: string | null
          barangay?: string | null
          city?: string
          province?: string
          confirmation_phrase?: string | null
          last_active?: string
        }
      }
      volunteer_profiles: {
        Row: {
          volunteer_user_id: string
          admin_user_id: string | null
          status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
          skills: string[] | null
          availability: string[] | null
          assigned_barangays: string[] | null
          total_incidents_resolved: number
          notes: string | null
          created_at: string
          updated_at: string
          last_status_change: string | null
          last_status_changed_by: string | null
          is_available: boolean | null
          last_active_at: string | null
        }
        Insert: {
          volunteer_user_id: string
          admin_user_id?: string | null
          status?: "ACTIVE" | "INACTIVE" | "SUSPENDED"
          skills?: string[] | null
          availability?: string[] | null
          assigned_barangays?: string[] | null
          total_incidents_resolved?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          last_status_change?: string | null
          last_status_changed_by?: string | null
          is_available?: boolean | null
          last_active_at?: string | null
        }
        Update: {
          volunteer_user_id?: string
          admin_user_id?: string | null
          status?: "ACTIVE" | "INACTIVE" | "SUSPENDED"
          skills?: string[] | null
          availability?: string[] | null
          assigned_barangays?: string[] | null
          total_incidents_resolved?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          last_status_change?: string | null
          last_status_changed_by?: string | null
          is_available?: boolean | null
          last_active_at?: string | null
        }
      }
      incidents: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          reporter_id: string | null
          incident_type: string
          description: string
          location_lat: number
          location_lng: number
          address: string | null
          barangay: string
          city: string
          province: string
          status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
          severity?: "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL" | null
          priority: number
          photo_url: string | null
          assigned_to: string | null
          assigned_at: string | null
          resolved_at: string | null
          resolution_notes: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          reporter_id?: string | null
          incident_type: string
          description: string
          location_lat: number
          location_lng: number
          address?: string | null
          barangay: string
          city?: string
          province?: string
          status?: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
          severity?: "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL" | null
          priority?: number
          photo_url?: string | null
          assigned_to?: string | null
          assigned_at?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          reporter_id?: string | null
          incident_type?: string
          description?: string
          location_lat?: number
          location_lng?: number
          address?: string | null
          barangay?: string
          city?: string
          province?: string
          status?: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
          severity?: "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL" | null
          priority?: number
          photo_url?: string | null
          assigned_to?: string | null
          assigned_at?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          user_id?: string | null
        }
      }
      incident_updates: {
        Row: {
          id: string
          incident_id: string
          updated_by: string | null
          previous_status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED" | null
          new_status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED" | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          updated_by?: string | null
          previous_status?: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED" | null
          new_status?: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED" | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          incident_id?: string
          updated_by?: string | null
          previous_status?: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED" | null
          new_status?: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED" | null
          notes?: string | null
          created_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          volunteer_id: string
          title: string
          description: string | null
          start_time: string
          end_time: string
          location: string | null
          barangay: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          volunteer_id: string
          title: string
          description?: string | null
          start_time: string
          end_time: string
          location?: string | null
          barangay?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          volunteer_id?: string
          title?: string
          description?: string | null
          start_time?: string
          end_time?: string
          location?: string | null
          barangay?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      barangays: {
        Row: {
          id: number
          name: string
          boundaries: Json | null
        }
        Insert: {
          id?: number
          name: string
          boundaries?: Json | null
        }
        Update: {
          id?: number
          name?: string
          boundaries?: Json | null
        }
      }
      emergency_contacts: {
        Row: {
          id: string
          name: string
          number: string
          type: "emergency" | "fire" | "police" | "medical" | "disaster" | "admin" | "utility"
          priority: number
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          number: string
          type: "emergency" | "fire" | "police" | "medical" | "disaster" | "admin" | "utility"
          priority?: number
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          number?: string
          type?: "emergency" | "fire" | "police" | "medical" | "disaster" | "admin" | "utility"
          priority?: number
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      call_logs: {
        Row: {
          id: string
          user_id: string
          contact_id: string
          contact_name: string
          contact_number: string
          call_type: "emergency" | "incident" | "volunteer" | "reporter" | "admin"
          incident_id: string | null
          duration: number | null
          status: "initiated" | "connected" | "missed" | "failed" | "completed"
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id: string
          contact_name: string
          contact_number: string
          call_type: "emergency" | "incident" | "volunteer" | "reporter" | "admin"
          incident_id?: string | null
          duration?: number | null
          status?: "initiated" | "connected" | "missed" | "failed" | "completed"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          contact_id?: string
          contact_name?: string
          contact_number?: string
          call_type?: "emergency" | "incident" | "volunteer" | "reporter" | "admin"
          incident_id?: string | null
          duration?: number | null
          status?: "initiated" | "connected" | "missed" | "failed" | "completed"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      call_preferences: {
        Row: {
          user_id: string
          favorite_contacts: string[]
          auto_log_calls: boolean
          call_reminders: boolean
          emergency_shortcut: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          favorite_contacts?: string[]
          auto_log_calls?: boolean
          call_reminders?: boolean
          emergency_shortcut?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          favorite_contacts?: string[]
          auto_log_calls?: boolean
          call_reminders?: boolean
          emergency_shortcut?: string
          created_at?: string
          updated_at?: string
        }
      }
      location_preferences: {
        Row: {
          id: string
          user_id: string
          enabled: boolean
          accuracy: "low" | "medium" | "high"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enabled?: boolean
          accuracy?: "low" | "medium" | "high"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          enabled?: boolean
          accuracy?: "low" | "medium" | "high"
          created_at?: string
          updated_at?: string
        }
      }
      location_tracking: {
        Row: {
          id: string
          user_id: string
          latitude: number
          longitude: number
          accuracy: number | null
          heading: number | null
          speed: number | null
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          latitude: number
          longitude: number
          accuracy?: number | null
          heading?: number | null
          speed?: number | null
          timestamp?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          latitude?: number
          longitude?: number
          accuracy?: number | null
          heading?: number | null
          speed?: number | null
          timestamp?: string
          created_at?: string
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          push: boolean
          sound: boolean
          vibration: boolean
          incident_alerts: boolean
          status_updates: boolean
          training_reminders: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          push?: boolean
          sound?: boolean
          vibration?: boolean
          incident_alerts?: boolean
          status_updates?: boolean
          training_reminders?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          push?: boolean
          sound?: boolean
          vibration?: boolean
          incident_alerts?: boolean
          status_updates?: boolean
          training_reminders?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          title: string
          body: string
          type: string
          data: Json | null
          read_at: string | null
          sent_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          body: string
          type: string
          data?: Json | null
          read_at?: string | null
          sent_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          body?: string
          type?: string
          data?: Json | null
          read_at?: string | null
          sent_at?: string
          created_at?: string
        }
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          subscription: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription?: Json
          created_at?: string
          updated_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          title: string
          report_type: "INCIDENT_REPORT" | "ACTIVITY_REPORT" | "SITUATION_REPORT"
          description: string
          incident_id: string | null
          created_by: string
          status: "SUBMITTED" | "REVIEWED" | "REJECTED"
          review_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          report_type: "INCIDENT_REPORT" | "ACTIVITY_REPORT" | "SITUATION_REPORT"
          description: string
          incident_id?: string | null
          created_by: string
          status?: "SUBMITTED" | "REVIEWED" | "REJECTED"
          review_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          report_type?: "INCIDENT_REPORT" | "ACTIVITY_REPORT" | "SITUATION_REPORT"
          description?: string
          incident_id?: string | null
          created_by?: string
          status?: "SUBMITTED" | "REVIEWED" | "REJECTED"
          review_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      scheduledactivities: {
        Row: {
          schedule_id: string
          volunteer_user_id: string
          created_by: string
          title: string
          description: string | null
          date: string
          time: string | null
          location: string | null
          is_accepted: boolean
          created_at: string
          response_at: string | null
        }
        Insert: {
          schedule_id?: string
          volunteer_user_id: string
          created_by: string
          title: string
          description?: string | null
          date: string
          time?: string | null
          location?: string | null
          is_accepted?: boolean
          created_at?: string
          response_at?: string | null
        }
        Update: {
          schedule_id?: string
          volunteer_user_id?: string
          created_by?: string
          title?: string
          description?: string | null
          date?: string
          time?: string | null
          location?: string | null
          is_accepted?: boolean
          created_at?: string
          response_at?: string | null
        }
      }
      volunteer_information: {
        Row: {
          user_id: string
          joined_date: string
          last_activity: string | null
          is_active: boolean
          bio: string | null
          skills: string | null
          documents: string | null
          verified: boolean
        }
        Insert: {
          user_id: string
          joined_date?: string
          last_activity?: string | null
          is_active?: boolean
          bio?: string | null
          skills?: string | null
          documents?: string | null
          verified?: boolean
        }
        Update: {
          user_id?: string
          joined_date?: string
          last_activity?: string | null
          is_active?: boolean
          bio?: string | null
          skills?: string | null
          documents?: string | null
          verified?: boolean
        }
      }
      volunteeractivities: {
        Row: {
          activity_id: string
          volunteer_user_id: string
          incident_id: string
          participated: boolean
          notes: string | null
          resolved_at: string | null
          created_at: string
          status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
        }
        Insert: {
          activity_id?: string
          volunteer_user_id: string
          incident_id: string
          participated?: boolean
          notes?: string | null
          resolved_at?: string | null
          created_at?: string
          status?: "PENDING" | "IN_PROGRESS" | "COMPLETED"
        }
        Update: {
          activity_id?: string
          volunteer_user_id?: string
          incident_id?: string
          participated?: boolean
          notes?: string | null
          resolved_at?: string | null
          created_at?: string
          status?: "PENDING" | "IN_PROGRESS" | "COMPLETED"
        }
      }
      trainings: {
        Row: {
          id: number
          title: string
          description: string | null
          start_at: string
          end_at: string | null
          location: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: number
          title: string
          description?: string | null
          start_at: string
          end_at?: string | null
          location?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: number
          title?: string
          description?: string | null
          start_at?: string
          end_at?: string | null
          location?: string | null
          created_by?: string
          created_at?: string
        }
      }
      training_evaluations: {
        Row: {
          id: number
          training_id: number
          user_id: string
          rating: number
          comments: string | null
          created_at: string
        }
        Insert: {
          id?: number
          training_id: number
          user_id: string
          rating: number
          comments?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          training_id?: number
          user_id?: string
          rating?: number
          comments?: string | null
          created_at?: string
        }
      }
      incident_handoffs: {
        Row: {
          id: number
          incident_id: string
          from_lgu: string
          to_lgu: string
          status: "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED"
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: number
          incident_id: string
          from_lgu: string
          to_lgu: string
          status?: "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED"
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: number
          incident_id?: string
          from_lgu?: string
          to_lgu?: string
          status?: "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED"
          notes?: string | null
          created_by?: string
          created_at?: string
        }
      }
      feedback: {
        Row: {
          id: number
          incident_id: string
          rating: number
          thumbs_up: boolean | null
          comment: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: number
          incident_id: string
          rating: number
          thumbs_up?: boolean | null
          comment?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: number
          incident_id?: string
          rating?: number
          thumbs_up?: boolean | null
          comment?: string | null
          created_by?: string
          created_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          type: "TRAINING" | "MEETING" | "ALERT" | "GENERAL"
          priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
          location: string | null
          date: string | null
          time: string | null
          requirements: string[] | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          type?: "TRAINING" | "MEETING" | "ALERT" | "GENERAL"
          priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
          location?: string | null
          date?: string | null
          time?: string | null
          requirements?: string[] | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          type?: "TRAINING" | "MEETING" | "ALERT" | "GENERAL"
          priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
          location?: string | null
          date?: string | null
          time?: string | null
          requirements?: string[] | null
          created_by?: string
          created_at?: string
        }
      }
    }
  }
}
