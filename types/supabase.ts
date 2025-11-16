export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_documents: {
        Row: {
          created_at: string | null
          file_name: string
          folder_id: string | null
          id: string
          mime_type: string | null
          path: string
          size_bytes: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          path: string
          size_bytes: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          path?: string
          size_bytes?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          date: string | null
          id: string
          location: string | null
          priority: string
          requirements: string[] | null
          time: string | null
          title: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          id?: string
          location?: string | null
          priority?: string
          requirements?: string[] | null
          time?: string | null
          title: string
          type?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          id?: string
          location?: string | null
          priority?: string
          requirements?: string[] | null
          time?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_archive_schedule: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          last_run: string | null
          next_run: string | null
          schedule_frequency: string | null
          schedule_time: string | null
          updated_at: string | null
          years_old: number | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_run?: string | null
          next_run?: string | null
          schedule_frequency?: string | null
          schedule_time?: string | null
          updated_at?: string | null
          years_old?: number | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_run?: string | null
          next_run?: string | null
          schedule_frequency?: string | null
          schedule_time?: string | null
          updated_at?: string | null
          years_old?: number | null
        }
        Relationships: []
      }
      barangays: {
        Row: {
          boundaries: Json | null
          id: number
          name: string
        }
        Insert: {
          boundaries?: Json | null
          id?: number
          name: string
        }
        Update: {
          boundaries?: Json | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_type: string
          contact_id: string
          contact_name: string
          contact_number: string
          created_at: string
          duration: number | null
          id: string
          incident_id: string | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_type: string
          contact_id: string
          contact_name: string
          contact_number: string
          created_at?: string
          duration?: number | null
          id?: string
          incident_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_type?: string
          contact_id?: string
          contact_name?: string
          contact_number?: string
          created_at?: string
          duration?: number | null
          id?: string
          incident_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      call_preferences: {
        Row: {
          auto_log_calls: boolean
          call_reminders: boolean
          created_at: string
          emergency_shortcut: string
          favorite_contacts: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_log_calls?: boolean
          call_reminders?: boolean
          created_at?: string
          emergency_shortcut?: string
          favorite_contacts?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_log_calls?: boolean
          call_reminders?: boolean
          created_at?: string
          emergency_shortcut?: string
          favorite_contacts?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          number: string
          priority: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          number: string
          priority?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          number?: string
          priority?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          id: number
          incident_id: string
          rating: number
          thumbs_up: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          incident_id: string
          rating: number
          thumbs_up?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          incident_id?: string
          rating?: number
          thumbs_up?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_boundaries: {
        Row: {
          boundary_type: string
          created_at: string | null
          geometry: Json
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          boundary_type: string
          created_at?: string | null
          geometry: Json
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          boundary_type?: string
          created_at?: string | null
          geometry?: Json
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      incident_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          incident_id: string
          rating: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          incident_id: string
          rating: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          rating?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_feedback_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_handoffs: {
        Row: {
          created_at: string
          created_by: string | null
          from_lgu: string
          id: number
          incident_id: string
          notes: string | null
          status: string
          to_lgu: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_lgu: string
          id?: number
          incident_id: string
          notes?: string | null
          status?: string
          to_lgu: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_lgu?: string
          id?: number
          incident_id?: string
          notes?: string | null
          status?: string
          to_lgu?: string
        }
        Relationships: []
      }
      incident_reference_ids: {
        Row: {
          created_at: string | null
          id: string
          incident_id: string
          reference_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          incident_id: string
          reference_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          incident_id?: string
          reference_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_incident_reference_ids_incident_id"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          created_at: string | null
          id: string
          incident_id: string | null
          new_status: Database["public"]["Enums"]["incident_status"] | null
          notes: string | null
          previous_status: Database["public"]["Enums"]["incident_status"] | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          incident_id?: string | null
          new_status?: Database["public"]["Enums"]["incident_status"] | null
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["incident_status"]
            | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          incident_id?: string | null
          new_status?: Database["public"]["Enums"]["incident_status"] | null
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["incident_status"]
            | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_views: {
        Row: {
          created_at: string | null
          id: string
          incident_id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          incident_id: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          incident_id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_incident_views_incident_id"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incident_views_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incident_views_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          address: string | null
          assigned_at: string | null
          assigned_to: string | null
          barangay: string
          city: string | null
          created_at: string | null
          created_year: number | null
          description: string
          id: string
          incident_type: string
          location_lat: number
          location_lng: number
          photo_url: string | null
          priority: number | null
          province: string | null
          reporter_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["incident_severity"] | null
          status: Database["public"]["Enums"]["incident_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          barangay: string
          city?: string | null
          created_at?: string | null
          created_year?: number | null
          description: string
          id?: string
          incident_type: string
          location_lat: number
          location_lng: number
          photo_url?: string | null
          priority?: number | null
          province?: string | null
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"] | null
          status?: Database["public"]["Enums"]["incident_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          barangay?: string
          city?: string | null
          created_at?: string | null
          created_year?: number | null
          description?: string
          id?: string
          incident_type?: string
          location_lat?: number
          location_lng?: number
          photo_url?: string | null
          priority?: number | null
          province?: string | null
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"] | null
          status?: Database["public"]["Enums"]["incident_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lgu_contacts: {
        Row: {
          agency_name: string
          contact_number: string
          contact_person: string | null
          created_at: string | null
          id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          agency_name: string
          contact_number: string
          contact_person?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_name?: string
          contact_number?: string
          contact_person?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      location_preferences: {
        Row: {
          accuracy: string | null
          created_at: string | null
          enabled: boolean | null
          id: string
          share_with_public: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accuracy?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          share_with_public?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accuracy?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          share_with_public?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          escalation_alerts: boolean | null
          id: string
          incident_alerts: boolean | null
          push: boolean | null
          push_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_enabled: boolean | null
          sound: boolean | null
          status_updates: boolean | null
          training_reminders: boolean | null
          updated_at: string | null
          user_id: string | null
          vibration: boolean | null
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          escalation_alerts?: boolean | null
          id?: string
          incident_alerts?: boolean | null
          push?: boolean | null
          push_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean | null
          sound?: boolean | null
          status_updates?: boolean | null
          training_reminders?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          vibration?: boolean | null
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          escalation_alerts?: boolean | null
          id?: string
          incident_alerts?: boolean | null
          push?: boolean | null
          push_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean | null
          sound?: boolean | null
          status_updates?: boolean | null
          training_reminders?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          vibration?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          read_at: string | null
          sent_at: string | null
          status: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          subscription: Json
          subscription_hash: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          subscription: Json
          subscription_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          subscription?: Json
          subscription_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          archived: boolean | null
          created_at: string | null
          created_by: string
          created_year: number | null
          description: string
          id: string
          incident_id: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"] | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          created_by: string
          created_year?: number | null
          description: string
          id?: string
          incident_id?: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          created_by?: string
          created_year?: number | null
          description?: string
          id?: string
          incident_id?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduledactivities: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          is_accepted: boolean | null
          location: string | null
          response_at: string | null
          schedule_id: string
          time: string | null
          title: string | null
          volunteer_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          is_accepted?: boolean | null
          location?: string | null
          response_at?: string | null
          schedule_id?: string
          time?: string | null
          title?: string | null
          volunteer_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          is_accepted?: boolean | null
          location?: string | null
          response_at?: string | null
          schedule_id?: string
          time?: string | null
          title?: string | null
          volunteer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduledactivities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduledactivities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduledactivities_volunteer_user_id_fkey"
            columns: ["volunteer_user_id"]
            isOneToOne: false
            referencedRelation: "volunteer_profiles"
            referencedColumns: ["volunteer_user_id"]
          },
        ]
      }
      schedules: {
        Row: {
          attendance_marked: boolean | null
          attendance_notes: string | null
          barangay: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          is_accepted: boolean | null
          location: string | null
          response_at: string | null
          start_time: string
          status: string | null
          title: string
          updated_at: string | null
          volunteer_id: string | null
        }
        Insert: {
          attendance_marked?: boolean | null
          attendance_notes?: string | null
          barangay?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          is_accepted?: boolean | null
          location?: string | null
          response_at?: string | null
          start_time: string
          status?: string | null
          title: string
          updated_at?: string | null
          volunteer_id?: string | null
        }
        Update: {
          attendance_marked?: boolean | null
          attendance_notes?: string | null
          barangay?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          is_accepted?: boolean | null
          location?: string | null
          response_at?: string | null
          start_time?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_deliveries: {
        Row: {
          api_response: Json | null
          attempt_timestamp: string | null
          created_at: string | null
          delivery_attempt: number | null
          delivery_status: string | null
          error_message: string | null
          id: string
          sms_log_id: string
        }
        Insert: {
          api_response?: Json | null
          attempt_timestamp?: string | null
          created_at?: string | null
          delivery_attempt?: number | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          sms_log_id: string
        }
        Update: {
          api_response?: Json | null
          attempt_timestamp?: string | null
          created_at?: string | null
          delivery_attempt?: number | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          sms_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_deliveries_sms_log_id_fkey"
            columns: ["sms_log_id"]
            isOneToOne: false
            referencedRelation: "sms_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          api_response: Json | null
          api_response_status: string | null
          created_at: string | null
          delivery_status: string | null
          error_message: string | null
          id: string
          incident_id: string
          message_content: string
          phone_masked: string
          recipient_user_id: string
          reference_id: string
          retry_count: number | null
          template_code: string
          timestamp_sent: string | null
          trigger_source: string
        }
        Insert: {
          api_response?: Json | null
          api_response_status?: string | null
          created_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          incident_id: string
          message_content: string
          phone_masked: string
          recipient_user_id: string
          reference_id: string
          retry_count?: number | null
          template_code: string
          timestamp_sent?: string | null
          trigger_source: string
        }
        Update: {
          api_response?: Json | null
          api_response_status?: string | null
          created_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          incident_id?: string
          message_content?: string
          phone_masked?: string
          recipient_user_id?: string
          reference_id?: string
          retry_count?: number | null
          template_code?: string
          timestamp_sent?: string | null
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_rate_limits: {
        Row: {
          created_at: string | null
          hour_count: number | null
          id: string
          last_reset_hour: string | null
          last_reset_minute: string | null
          minute_count: number | null
          phone_number_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hour_count?: number | null
          id?: string
          last_reset_hour?: string | null
          last_reset_minute?: string | null
          minute_count?: number | null
          phone_number_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hour_count?: number | null
          id?: string
          last_reset_hour?: string | null
          last_reset_minute?: string | null
          minute_count?: number | null
          phone_number_hash?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          code: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          code: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          code?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          created_at: string | null
          details: string | null
          error_message: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: string | null
          error_message?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string | null
          error_message?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_evaluations: {
        Row: {
          comments: string | null
          created_at: string
          id: number
          rating: number
          training_id: number
          user_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: number
          rating: number
          training_id: number
          user_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: number
          rating?: number
          training_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_evaluations_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: number
          location: string | null
          start_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: number
          location?: string | null
          start_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: number
          location?: string | null
          start_at?: string
          title?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          address: string | null
          barangay: string | null
          city: string | null
          confirmation_phrase: string | null
          created_at: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string
          gender: string | null
          id: string
          last_active: string | null
          last_name: string
          phone_number: string | null
          profile_photo_url: string | null
          province: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          barangay?: string | null
          city?: string | null
          confirmation_phrase?: string | null
          created_at?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name: string
          gender?: string | null
          id: string
          last_active?: string | null
          last_name: string
          phone_number?: string | null
          profile_photo_url?: string | null
          province?: string | null
          role: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          barangay?: string | null
          city?: string | null
          confirmation_phrase?: string | null
          created_at?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_active?: string | null
          last_name?: string
          phone_number?: string | null
          profile_photo_url?: string | null
          province?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      volunteer_activity_logs: {
        Row: {
          activity_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          title: string
          volunteer_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          title: string
          volunteer_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_activity_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_activity_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_activity_logs_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_activity_logs_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_documents: {
        Row: {
          created_at: string | null
          file_name: string
          id: string
          mime_type: string | null
          path: string
          size_bytes: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          path: string
          size_bytes: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          path?: string
          size_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_information: {
        Row: {
          bio: string | null
          documents: string | null
          is_active: boolean | null
          joined_date: string | null
          last_activity: string | null
          skills: string | null
          user_id: string
          verified: boolean | null
        }
        Insert: {
          bio?: string | null
          documents?: string | null
          is_active?: boolean | null
          joined_date?: string | null
          last_activity?: string | null
          skills?: string | null
          user_id: string
          verified?: boolean | null
        }
        Update: {
          bio?: string | null
          documents?: string | null
          is_active?: boolean | null
          joined_date?: string | null
          last_activity?: string | null
          skills?: string | null
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_information_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_information_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          heading: number | null
          id: string
          is_within_talisay_city: boolean | null
          lat: number
          lng: number
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          is_within_talisay_city?: boolean | null
          lat: number
          lng: number
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          is_within_talisay_city?: boolean | null
          lat?: number
          lng?: number
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_profiles: {
        Row: {
          admin_user_id: string | null
          assigned_barangays: string[] | null
          availability: string[] | null
          created_at: string | null
          is_available: boolean | null
          last_active_at: string | null
          last_status_change: string | null
          last_status_changed_by: string | null
          notes: string | null
          skills: string[] | null
          status: Database["public"]["Enums"]["volunteer_status"] | null
          total_incidents_resolved: number | null
          updated_at: string | null
          volunteer_user_id: string
        }
        Insert: {
          admin_user_id?: string | null
          assigned_barangays?: string[] | null
          availability?: string[] | null
          created_at?: string | null
          is_available?: boolean | null
          last_active_at?: string | null
          last_status_change?: string | null
          last_status_changed_by?: string | null
          notes?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["volunteer_status"] | null
          total_incidents_resolved?: number | null
          updated_at?: string | null
          volunteer_user_id: string
        }
        Update: {
          admin_user_id?: string | null
          assigned_barangays?: string[] | null
          availability?: string[] | null
          created_at?: string | null
          is_available?: boolean | null
          last_active_at?: string | null
          last_status_change?: string | null
          last_status_changed_by?: string | null
          notes?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["volunteer_status"] | null
          total_incidents_resolved?: number | null
          updated_at?: string | null
          volunteer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_profiles_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_profiles_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_profiles_last_status_changed_by_fkey"
            columns: ["last_status_changed_by"]
            isOneToOne: false
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_profiles_last_status_changed_by_fkey"
            columns: ["last_status_changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_profiles_volunteer_user_id_fkey"
            columns: ["volunteer_user_id"]
            isOneToOne: true
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_profiles_volunteer_user_id_fkey"
            columns: ["volunteer_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_real_time_status: {
        Row: {
          created_at: string | null
          last_activity: string | null
          last_status_change: string | null
          status: string
          status_message: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          last_activity?: string | null
          last_status_change?: string | null
          status?: string
          status_message?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          last_activity?: string | null
          last_status_change?: string | null
          status?: string
          status_message?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_real_time_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "active_volunteers_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_real_time_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteeractivities: {
        Row: {
          activity_id: string
          created_at: string | null
          incident_id: string | null
          notes: string | null
          participated: boolean | null
          resolved_at: string | null
          status: string | null
          volunteer_user_id: string | null
        }
        Insert: {
          activity_id?: string
          created_at?: string | null
          incident_id?: string | null
          notes?: string | null
          participated?: boolean | null
          resolved_at?: string | null
          status?: string | null
          volunteer_user_id?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          incident_id?: string | null
          notes?: string | null
          participated?: boolean | null
          resolved_at?: string | null
          status?: string | null
          volunteer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteeractivities_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteeractivities_volunteer_user_id_fkey"
            columns: ["volunteer_user_id"]
            isOneToOne: false
            referencedRelation: "volunteer_profiles"
            referencedColumns: ["volunteer_user_id"]
          },
        ]
      }
    }
    Views: {
      active_volunteers_with_location: {
        Row: {
          accuracy: number | null
          assigned_barangays: string[] | null
          email: string | null
          first_name: string | null
          id: string | null
          is_available: boolean | null
          last_activity: string | null
          last_location_update: string | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          phone_number: string | null
          realtime_status: string | null
          skills: string[] | null
          status_message: string | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      rvois_index_health: {
        Row: {
          index_name: unknown
          scans: number | null
          schemaname: unknown
          size: string | null
          tablename: unknown
          usage_status: string | null
        }
        Relationships: []
      }
      schedule_statistics: {
        Row: {
          accepted_count: number | null
          active_count: number | null
          attendance_marked_count: number | null
          cancelled_count: number | null
          completed_count: number | null
          declined_count: number | null
          ongoing_count: number | null
          pending_response_count: number | null
          scheduled_count: number | null
          total_count: number | null
          upcoming_count: number | null
        }
        Relationships: []
      }
      sms_dashboard_stats: {
        Row: {
          date: string | null
          failure_count: number | null
          pending_count: number | null
          success_count: number | null
          success_rate: number | null
          total_sent: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      check_overdue_incidents: { Args: never; Returns: undefined }
      check_sms_rate_limit: { Args: { phone_hash: string }; Returns: boolean }
      cleanup_old_location_data: { Args: never; Returns: number }
      cleanup_old_sms_logs: { Args: never; Returns: undefined }
      cleanup_old_volunteer_locations: { Args: never; Returns: number }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_volunteers: {
        Args: never
        Returns: {
          accuracy: number
          first_name: string
          heading: number
          is_available: boolean
          last_name: string
          last_seen: string
          latitude: number
          longitude: number
          phone_number: string
          speed: number
          user_id: string
        }[]
      }
      get_realtime_connection_status: {
        Args: never
        Returns: {
          active_volunteers_count: number
          is_connected: boolean
          last_activity: string
        }[]
      }
      get_sms_statistics: {
        Args: never
        Returns: {
          failure_count: number
          failure_rate: number
          success_count: number
          success_rate: number
          total_sent: number
        }[]
      }
      get_unread_notification_count: { Args: never; Returns: number }
      get_volunteers_within_radius: {
        Args: { center_lat: number; center_lng: number; radius_km?: number }
        Returns: {
          accuracy: number
          assigned_barangays: string[]
          distance_km: number
          email: string
          first_name: string
          heading: number
          is_available: boolean
          last_name: string
          last_seen: string
          latitude: number
          longitude: number
          phone_number: string
          skills: string[]
          speed: number
          user_id: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      increment_sms_rate_limit: {
        Args: { phone_hash: string }
        Returns: undefined
      }
      is_admin_user: { Args: { user_id: string }; Returns: boolean }
      is_within_talisay_city: {
        Args: { check_lat: number; check_lng: number }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_notification_as_read: {
        Args: { notification_ids: string[] }
        Returns: Json
      }
      monitor_location_tracking_health: {
        Args: never
        Returns: {
          active_last_30min: number
          active_last_5min: number
          avg_accuracy: number
          newest_location: string
          oldest_location: string
          total_locations_today: number
          total_volunteers: number
        }[]
      }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      rvois_check_index_usage: {
        Args: never
        Returns: {
          idx_scan: number
          idx_tup_fetch: number
          idx_tup_read: number
          index_size: string
          indexname: string
          schemaname: string
          tablename: string
          usage_note: string
        }[]
      }
      rvois_find_missing_fk_indexes: {
        Args: never
        Returns: {
          column_name: string
          constraint_name: string
          referenced_table: string
          table_name: string
        }[]
      }
      rvois_get_table_sizes: {
        Args: never
        Returns: {
          index_ratio: string
          indexes_size: string
          row_count: number
          table_name: string
          table_size: string
          total_size: string
        }[]
      }
      send_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      activity_status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
      activity_type:
        | "OUTREACH_PROGRAM"
        | "SCHOOL_VISIT"
        | "COMMUNITY_VISIT"
        | "DISASTER_PREPAREDNESS"
        | "RESCUE_TRAINING"
        | "EMERGENCY_DRILL"
        | "AWARENESS_CAMPAIGN"
        | "EQUIPMENT_TRAINING"
        | "TEAM_BUILDING"
        | "OTHER"
      incident_severity: "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL"
      incident_status:
        | "PENDING"
        | "ASSIGNED"
        | "RESPONDING"
        | "RESOLVED"
        | "CANCELLED"
      notification_type:
        | "INCIDENT_ASSIGNED"
        | "SCHEDULE_UPDATE"
        | "PROFILE_VERIFICATION"
        | "SYSTEM_ALERT"
        | "FEEDBACK_RECEIVED"
      report_status: "SUBMITTED" | "REVIEWED" | "REJECTED"
      report_type: "INCIDENT_REPORT" | "ACTIVITY_REPORT" | "SITUATION_REPORT"
      user_role: "admin" | "volunteer" | "resident" | "barangay"
      volunteer_status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_status: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      activity_type: [
        "OUTREACH_PROGRAM",
        "SCHOOL_VISIT",
        "COMMUNITY_VISIT",
        "DISASTER_PREPAREDNESS",
        "RESCUE_TRAINING",
        "EMERGENCY_DRILL",
        "AWARENESS_CAMPAIGN",
        "EQUIPMENT_TRAINING",
        "TEAM_BUILDING",
        "OTHER",
      ],
      incident_severity: ["MINOR", "MODERATE", "SEVERE", "CRITICAL"],
      incident_status: [
        "PENDING",
        "ASSIGNED",
        "RESPONDING",
        "RESOLVED",
        "CANCELLED",
      ],
      notification_type: [
        "INCIDENT_ASSIGNED",
        "SCHEDULE_UPDATE",
        "PROFILE_VERIFICATION",
        "SYSTEM_ALERT",
        "FEEDBACK_RECEIVED",
      ],
      report_status: ["SUBMITTED", "REVIEWED", "REJECTED"],
      report_type: ["INCIDENT_REPORT", "ACTIVITY_REPORT", "SITUATION_REPORT"],
      user_role: ["admin", "volunteer", "resident", "barangay"],
      volunteer_status: ["ACTIVE", "INACTIVE", "SUSPENDED"],
    },
  },
} as const
