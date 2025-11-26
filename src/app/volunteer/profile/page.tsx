"use client"

import React, { useEffect, useState, useCallback, useMemo } from "react"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerProfile, updateVolunteerProfile, updateVolunteerAvailability, updateVolunteerPersonalInfo } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, CheckCircle, Save, User, FileText, Activity, Download, Calendar } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { UserWithVolunteerProfile } from "@/types/volunteer"
import { ProfilePhotoUpload } from "@/components/volunteer/profile-photo-upload"
import { DocumentUpload } from "@/components/volunteer/document-upload"
import { ActivityLog } from "@/components/volunteer/activity-log"
import { ProfileExport } from "@/components/volunteer/profile-export"
import { SkillsSelector, AvailabilitySelector, StatusBadge } from "./profile-components"
import { ScheduleHistory } from "@/components/volunteer/schedule-history"

// Main component

export default function VolunteerProfilePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserWithVolunteerProfile | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)

  // Form state - Personal Information
  const [personalInfo, setPersonalInfo] = useState({
    phoneNumber: "",
    address: "",
    barangay: "",
    gender: "" as "male" | "female" | "other" | "prefer_not_to_say" | "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: ""
  })

  // Form state - Volunteer Profile
  const [volunteerData, setVolunteerData] = useState({
    skills: [] as string[],
    availability: [] as string[],
    notes: ""
  })

  // Active tab state
  const [activeTab, setActiveTab] = useState<'profile' | 'schedules' | 'documents' | 'activity'>('profile')

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return

      try {
        setLoading(true)
        const result = await getVolunteerProfile(user.id)

        if (result.success && result.data) {
          setProfile(result.data as UserWithVolunteerProfile)
          setIsAvailable(result.data.volunteer_profiles?.is_available || false)
          
          // Set personal information
          setPersonalInfo({
            phoneNumber: result.data.phone_number || "",
            address: result.data.address || "",
            barangay: result.data.barangay || "",
            gender: result.data.gender || "",
            emergencyContactName: result.data.emergency_contact_name || "",
            emergencyContactPhone: result.data.emergency_contact_phone || "",
            emergencyContactRelationship: result.data.emergency_contact_relationship || ""
          })
          
          // Set volunteer data
          setVolunteerData({
            skills: result.data.volunteer_profiles?.skills || [],
            availability: result.data.volunteer_profiles?.availability || [],
            notes: result.data.volunteer_profiles?.notes || ""
          })
        } else {
          setError(result.message || "Failed to load profile")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [user])

  const handleAvailabilityToggle = async (checked: boolean) => {
    if (!user) return

    try {
      setUpdatingAvailability(true)
      const result = await updateVolunteerAvailability(user.id, checked)
      if (result.success) {
        setIsAvailable(checked)
        toast({
          title: checked ? "You are now available for assignments" : "You are now unavailable for assignments",
          variant: "default"
        })
      } else {
        throw new Error(result.message)
      }
    } catch (err: any) {
      toast({
        title: "Failed to update availability",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setUpdatingAvailability(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      // Update personal information
      const personalResult = await updateVolunteerPersonalInfo(user.id, {
        phone_number: personalInfo.phoneNumber,
        address: personalInfo.address,
        barangay: personalInfo.barangay,
        gender: personalInfo.gender || undefined,
        emergency_contact_name: personalInfo.emergencyContactName,
        emergency_contact_phone: personalInfo.emergencyContactPhone,
        emergency_contact_relationship: personalInfo.emergencyContactRelationship
      })

      if (!personalResult.success) {
        throw new Error(personalResult.message || "Failed to update personal information")
      }

      // Update volunteer profile
      const profileResult = await updateVolunteerProfile(user.id, {
        skills: volunteerData.skills,
        availability: volunteerData.availability,
        notes: volunteerData.notes
      })

      if (!profileResult.success) {
        throw new Error(profileResult.message || "Failed to update volunteer profile")
      }

      // Refresh profile data
      const updatedProfile = await getVolunteerProfile(user.id)
      if (updatedProfile.success && updatedProfile.data) {
        setProfile(updatedProfile.data as UserWithVolunteerProfile)
      }

      setSuccess("Profile updated successfully")
      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully",
        variant: "default"
      })
    } catch (err: any) {
      setError(err.message || "Failed to update profile")
      toast({
        title: "Error",
        description: err.message || "Failed to update profile",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleSkill = (skill: string) => {
    setVolunteerData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }))
  }

  const toggleDay = (day: string) => {
    setVolunteerData(prev => ({
      ...prev,
      availability: prev.availability.includes(day)
        ? prev.availability.filter(d => d !== day)
        : [...prev.availability, day]
    }))
  }

  const handlePhotoUpdate = (url: string | null) => {
    if (profile) {
      setProfile({
        ...profile,
        profile_photo_url: url || undefined
      })
    }
  }

  if (loading) {
    return (
      <VolunteerLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading profile..." />
        </div>
      </VolunteerLayout>
    )
  }

  return (
    <VolunteerLayout>
      <div className="max-w-7xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Section */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Volunteer Profile</h1>
              <p className="mt-1 text-sm text-gray-500">Manage your personal information, skills, and availability</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <StatusBadge status={profile?.volunteer_profiles?.status || "INACTIVE"} />
              </div>
              {profile && <ProfileExport profile={profile} />}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Incidents Resolved</p>
                  <p className="text-2xl font-bold text-gray-900">{profile?.volunteer_profiles?.total_incidents_resolved || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Skills</p>
                  <p className="text-2xl font-bold text-gray-900">{volunteerData.skills.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Availability</p>
                  <p className="text-2xl font-bold text-gray-900">{volunteerData.availability.length} days</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="ml-3 text-sm text-green-700">{success}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Profile Information
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('schedules')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'schedules'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Schedule History
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'documents'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'activity'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Activity Log
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Photo Section */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Photo</h2>
              <div className="flex justify-center">
                {user && (
                  <ProfilePhotoUpload
                    currentPhotoUrl={profile?.profile_photo_url}
                    onPhotoUpdate={handlePhotoUpdate}
                    userId={user.id}
                  />
                )}
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    value={personalInfo.phoneNumber}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="+63 XXX XXX XXXX"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={personalInfo.gender}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, gender: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={personalInfo.address}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Street, House Number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="barangay" className="block text-sm font-medium text-gray-700 mb-2">
                    Barangay
                  </label>
                  <input
                    type="text"
                    id="barangay"
                    value={personalInfo.barangay}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, barangay: e.target.value }))}
                    placeholder="Barangay name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact Section */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    id="emergencyContactName"
                    value={personalInfo.emergencyContactName}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    id="emergencyContactPhone"
                    value={personalInfo.emergencyContactPhone}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                    placeholder="+63 XXX XXX XXXX"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="emergencyContactRelationship" className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship
                  </label>
                  <input
                    type="text"
                    id="emergencyContactRelationship"
                    value={personalInfo.emergencyContactRelationship}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, emergencyContactRelationship: e.target.value }))}
                    placeholder="e.g., Spouse, Parent, Sibling"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Skills & Certifications Section */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills & Certifications</h2>
              <SkillsSelector skills={volunteerData.skills} onToggleSkill={toggleSkill} />
            </div>

            {/* Availability Section */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Availability</h2>
              <AvailabilitySelector availability={volunteerData.availability} onToggleDay={toggleDay} />
            </div>

            {/* Notes Section */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h2>
              <textarea
                id="notes"
                rows={4}
                value={volunteerData.notes}
                onChange={(e) => setVolunteerData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any relevant notes about your volunteer work, experience, or preferences..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors resize-none"
              />
            </div>

            {/* Availability Toggle */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignment Availability</h2>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3">
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={handleAvailabilityToggle}
                    disabled={updatingAvailability}
                    className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200"
                  />
                  <div>
                    <span className="text-sm font-semibold text-gray-900 block">
                      {isAvailable ? "Available for Assignments" : "Not Available"}
                    </span>
                    <span className="text-sm text-gray-500">
                      {isAvailable 
                        ? "You will receive notifications for new incident assignments" 
                        : "You won't receive any new incident assignments"}
                    </span>
                  </div>
                </div>
                {updatingAvailability && <LoadingSpinner size="sm" />}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save All Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Schedules Tab */}
        {activeTab === 'schedules' && user && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <ScheduleHistory volunteerId={user.id} />
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && user && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <DocumentUpload userId={user.id} />
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && user && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <ActivityLog volunteerId={user.id} showFilters={true} />
          </div>
        )}
      </div>
    </VolunteerLayout>
  )
}
