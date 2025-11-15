export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: 'admin' | 'volunteer' | 'resident' | 'barangay';
          phone_number: string | null;
          address: string | null;
          barangay: string | null;
          city: string;
          province: string;
          confirmation_phrase: string | null;
          last_active: string;
          created_at: string;
          updated_at: string;
          status: 'active' | 'inactive';
        }
        Insert: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: 'admin' | 'volunteer' | 'resident' | 'barangay';
          phone_number?: string | null;
          address?: string | null;
          barangay?: string | null;
          city?: string;
          province?: string;
          confirmation_phrase?: string | null;
          last_active?: string;
          created_at?: string;
          updated_at?: string;
          status?: 'active' | 'inactive';
        }
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          role?: 'admin' | 'volunteer' | 'resident' | 'barangay';
          phone_number?: string | null;
          address?: string | null;
          barangay?: string | null;
          city?: string;
          province?: string;
          confirmation_phrase?: string | null;
          last_active?: string;
          created_at?: string;
          updated_at?: string;
          status?: 'active' | 'inactive';
        }
      }
      volunteer_profiles: {
        Row: {
          volunteer_user_id: string;
          admin_user_id: string | null;
          status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          skills: string[] | null;
          availability: string[] | null;
          assigned_barangays: string[] | null;
          total_incidents_resolved: number;
          notes: string | null;
          is_available: boolean;
          created_at: string;
          updated_at: string;
          last_status_change: string | null;
          last_status_changed_by: string | null;
          last_active?: string;
        }
        Insert: {
          volunteer_user_id: string;
          admin_user_id?: string | null;
          status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          skills?: string[] | null;
          availability?: string[] | null;
          assigned_barangays?: string[] | null;
          total_incidents_resolved?: number;
          notes?: string | null;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
          last_status_change?: string | null;
          last_status_changed_by?: string | null;
          last_active?: string;
        }
        Update: {
          volunteer_user_id?: string;
          admin_user_id?: string | null;
          status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          skills?: string[] | null;
          availability?: string[] | null;
          assigned_barangays?: string[] | null;
          total_incidents_resolved?: number;
          notes?: string | null;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
          last_status_change?: string | null;
          last_status_changed_by?: string | null;
          last_active?: string;
        }
      }
      schedules: {
        Row: {
          id: string;
          volunteer_id: string;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string;
          location: string | null;
          barangay: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        }
        Insert: {
          id?: string;
          volunteer_id: string;
          title: string;
          description?: string | null;
          start_time: string;
          end_time: string;
          location?: string | null;
          barangay?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        }
        Update: {
          id?: string;
          volunteer_id?: string;
          title?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string;
          location?: string | null;
          barangay?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        }
      }
      incidents: {
        Row: {
          id: string;
          reporter_id: string;
          incident_type: string;
          description: string;
          location_lat: number;
          location_lng: number;
          address: string | null;
          barangay: string;
          city: string;
          province: string;
          status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          priority: number;
          photo_url: string | null;
          assigned_to: string | null;
          assigned_at: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          created_at: string;
          updated_at: string;
        }
        Insert: {
          id?: string;
          reporter_id: string;
          incident_type: string;
          description: string;
          location_lat: number;
          location_lng: number;
          address?: string | null;
          barangay: string;
          city?: string;
          province?: string;
          status?: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          priority?: number;
          photo_url?: string | null;
          assigned_to?: string | null;
          assigned_at?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
        Update: {
          id?: string;
          reporter_id?: string;
          incident_type?: string;
          description?: string;
          location_lat?: number;
          location_lng?: number;
          address?: string | null;
          barangay?: string;
          city?: string;
          province?: string;
          status?: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          priority?: number;
          photo_url?: string | null;
          assigned_to?: string | null;
          assigned_at?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      }
      incident_updates: {
        Row: {
          id: string;
          incident_id: string;
          updated_by: string;
          previous_status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          new_status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          notes: string | null;
          created_at: string;
        }
        Insert: {
          id?: string;
          incident_id: string;
          updated_by: string;
          previous_status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          new_status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          notes?: string | null;
          created_at?: string;
        }
        Update: {
          id?: string;
          incident_id?: string;
          updated_by?: string;
          previous_status?: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          new_status?: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
          notes?: string | null;
          created_at?: string;
        }
      }
      reports: {
        Row: {
          id: string;
          title: string;
          report_type: 'INCIDENT_REPORT' | 'ACTIVITY_REPORT' | 'SITUATION_REPORT';
          description: string;
          incident_id: string | null;
          created_by: string;
          status: 'SUBMITTED' | 'REVIEWED' | 'REJECTED';
          review_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
          archived: boolean;
        }
        Insert: {
          id?: string;
          title: string;
          report_type: 'INCIDENT_REPORT' | 'ACTIVITY_REPORT' | 'SITUATION_REPORT';
          description: string;
          incident_id?: string | null;
          created_by: string;
          status?: 'SUBMITTED' | 'REVIEWED' | 'REJECTED';
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived?: boolean;
        }
        Update: {
          id?: string;
          title?: string;
          report_type?: 'INCIDENT_REPORT' | 'ACTIVITY_REPORT' | 'SITUATION_REPORT';
          description?: string;
          incident_id?: string | null;
          created_by?: string;
          status?: 'SUBMITTED' | 'REVIEWED' | 'REJECTED';
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived?: boolean;
        }
      }
      barangays: {
        Row: {
          id: number;
          name: string;
          boundaries: any;
        }
        Insert: {
          id?: number;
          name: string;
          boundaries?: any;
        }
        Update: {
          id?: number;
          name?: string;
          boundaries?: any;
        }
      }
    }
  }
}