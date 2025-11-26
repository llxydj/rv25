// Volunteer profile status type
export type VolunteerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

// Base volunteer profile interface matching database schema
export interface VolunteerProfile {
  volunteer_user_id: string;
  admin_user_id: string | null;
  status: VolunteerStatus;
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

// Extended interface for user with volunteer profile
export interface UserWithVolunteerProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  address?: string;
  barangay?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  profile_photo_url?: string;
  role: 'volunteer';
  volunteer_profiles: VolunteerProfile | null;  // Allow null profiles
}

// Interface for creating/updating volunteer profiles
export interface VolunteerProfileUpdate {
  skills?: string[];
  availability?: string[];
  notes?: string;
  is_available?: boolean;
  assigned_barangays?: string[];
}

// Activity log types
export type ActivityType =
  | 'profile_updated'
  | 'availability_changed'
  | 'incident_assigned'
  | 'incident_resolved'
  | 'document_uploaded'
  | 'photo_uploaded'
  | 'skills_updated'
  | 'status_changed'
  | 'training_completed'
  | 'other';

// Volunteer activity log interface
export interface VolunteerActivityLog {
  id: string;
  volunteer_id: string;
  activity_type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
  created_by_user?: {
    first_name: string;
    last_name: string;
  };
}

// Document interface
export interface VolunteerDocument {
  id: string;
  user_id: string;
  path: string;
  file_name: string;
  mime_type?: string;
  size_bytes: number;
  created_at: string;
} 