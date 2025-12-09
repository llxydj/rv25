"use client"

import { useState, useEffect, useRef } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Bell, Save, Shield, User, AlertCircle, Camera, Power as LogOut } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { PinManagement } from "@/components/pin-management"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { pushNotificationService } from "@/lib/push-notification-service"

export default function AdminSettings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"account" | "notifications" | "security">("account")
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    profilePhoto: "",
  })

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    email_enabled: true,
    sms_enabled: false,
    push_enabled: true,
    incident_alerts: true,
    status_updates: true,
  })
  const [prefsLoading, setPrefsLoading] = useState(false)

  // Profile photo upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Load current profile data
  const fetchProfile = async () => {
    try {
      setFetching(true)
      setError(null)
      const res = await fetch('/api/user/profile', {
        cache: 'no-store', // Always fetch fresh data
        credentials: 'include'
      })
      const json = await res.json()
      
      if (json.error) {
        setError(json.error)
        return
      }

      // Update profile data from database
      setProfileData({
        firstName: json.first_name || "",
        lastName: json.last_name || "",
        email: json.email || "",
        phone: json.phone_number || "",
        profilePhoto: json.profile_photo_url || json.profile_image || "",
      })
    } catch (err: any) {
      setError('Failed to load profile data')
      console.error('Profile fetch error:', err)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchProfile()
    fetchNotificationPreferences()
  }, [])

  // Load notification preferences
  const fetchNotificationPreferences = async () => {
    try {
      const res = await fetch('/api/notifications/preferences', {
        cache: 'no-store',
        credentials: 'include'
      })
      const json = await res.json()
      
      if (json.success && json.data) {
        setNotificationPrefs({
          email_enabled: json.data.email_enabled ?? true,
          sms_enabled: json.data.sms_enabled ?? false,
          push_enabled: json.data.push_enabled ?? true,
          incident_alerts: json.data.incident_alerts ?? true,
          status_updates: json.data.status_updates ?? true,
        })
      }
    } catch (err) {
      console.error('Failed to load notification preferences:', err)
    }
  }

  // Handle password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('All password fields are required')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    try {
      setPasswordLoading(true)

      // SECURITY: Check PIN verification before allowing password change
      const pinCheckRes = await fetch('/api/pin/check-verified', {
        credentials: 'include',
        cache: 'no-store'
      })
      
      if (pinCheckRes.ok) {
        const pinCheckJson = await pinCheckRes.json()
        if (!pinCheckJson.verified) {
          // PIN not verified - require re-verification
          setPasswordError('PIN verification required for security. Please verify your PIN first.')
          // Redirect to PIN verify page
          window.location.href = `/pin/verify?redirect=${encodeURIComponent('/admin/settings')}`
          return
        }
      } else {
        // If PIN check fails, require verification for security
        setPasswordError('PIN verification required for security. Please verify your PIN first.')
        window.location.href = `/pin/verify?redirect=${encodeURIComponent('/admin/settings')}`
        return
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profileData.email,
        password: passwordData.currentPassword,
      })

      if (signInError) {
        setPasswordError('Current password is incorrect')
        return
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (error) {
        throw new Error(error.message)
      }

      // Clear fields
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
      
      // Require PIN re-verification after password change for security
      await fetch('/api/pin/require-reverify', {
        method: 'POST',
        credentials: 'include'
      }).catch(() => {
        // Ignore errors - this is a security enhancement
      })
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  // Handle notification preferences save
  const handleSaveNotificationPreferences = async () => {
    try {
      setPrefsLoading(true)
      setError(null)

      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationPrefs),
        credentials: 'include'
      })

      const json = await res.json()

      if (!json.success) {
        throw new Error(json.message || 'Failed to update notification preferences')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save notification preferences')
    } finally {
      setPrefsLoading(false)
    }
  }

  // Handle profile photo upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB")
      return
    }

    try {
      setUploadingPhoto(true)
      setError(null)

      // Upload to Supabase Storage
      const fileName = `${user.id}-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("profile-images")
        .getPublicUrl(fileName)

      // Update user profile with image URL
      // Update both fields for consistency (some parts of system use profile_image, others use profile_photo_url)
      const { error: updateError } = await supabase
        .from("users")
        .update({ 
          profile_image: publicUrl,
          profile_photo_url: publicUrl 
        })
        .eq("id", user.id)

      if (updateError) throw updateError

      setProfileData(prev => ({ ...prev, profilePhoto: publicUrl }))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error: any) {
      console.error("Image upload error:", error)
      setError(error.message || "Failed to upload image")
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
  }

  const handleSaveSettings = async () => {
    if (activeTab === "notifications") {
      await handleSaveNotificationPreferences()
      return
    }

    if (activeTab !== "account") {
      return
    }

    // Validate account tab data
    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      setError('First name and last name are required')
      return
    }

    setLoading(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: profileData.firstName.trim(),
          last_name: profileData.lastName.trim(),
          phone_number: profileData.phone.trim() || null,
        })
      })

      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'Failed to update profile')
      }

      // Refetch profile data from database to ensure we have the latest
      // This ensures we get any computed fields, triggers, or other updates
      await fetchProfile()

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading profile..." />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Settings</h1>
          <div className="mt-4 md:mt-0">
            <button
              onClick={handleSaveSettings}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-green-700">Settings saved successfully!</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex border-b overflow-x-auto scrollbar-hide">
            <button
              className={`px-3 md:px-4 py-3 md:py-4 text-xs md:text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 touch-manipulation ${
                activeTab === "account"
                  ? "text-blue-600 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-blue-600 hover:border-blue-300"
              }`}
              onClick={() => setActiveTab("account")}
            >
              <User className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden sm:inline">Account Settings</span>
              <span className="sm:hidden">Account</span>
            </button>
            <button
              className={`px-3 md:px-4 py-3 md:py-4 text-xs md:text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 touch-manipulation ${
                activeTab === "notifications"
                  ? "text-blue-600 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-blue-600 hover:border-blue-300"
              }`}
              onClick={() => setActiveTab("notifications")}
            >
              <Bell className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden sm:inline">Notifications</span>
              <span className="sm:hidden">Notify</span>
            </button>
            <button
              className={`px-3 md:px-4 py-3 md:py-4 text-xs md:text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 touch-manipulation ${
                activeTab === "security"
                  ? "text-blue-600 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-blue-600 hover:border-blue-300"
              }`}
              onClick={() => setActiveTab("security")}
            >
              <Shield className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
              Security
            </button>
          </div>

          <div className="p-6">
            {activeTab === "account" && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium">Account Information</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="first-name"
                      value={profileData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="last-name"
                      value={profileData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={profileData.email}
                      disabled
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500 sm:text-sm cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="+639123456789"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h2 className="text-lg font-medium mb-4">Profile Photo</h2>
                  <div className="flex items-center space-x-6">
                    <div className="relative">
                      {profileData.profilePhoto ? (
                        <img
                          src={profileData.profilePhoto}
                          alt="Profile"
                          className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                          {profileData.firstName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="absolute bottom-0 right-0 rounded-full bg-blue-600 p-2 shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Camera className="h-4 w-4 text-white" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-700 font-medium">Profile Photo</p>
                      <p className="text-sm text-gray-500">
                        {uploadingPhoto ? "Uploading..." : "Click the camera icon to upload a new photo"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Max size: 5MB. JPG, PNG, or GIF</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium">Notification Preferences</h2>
                <p className="text-sm text-gray-500">Manage how you receive notifications from the system</p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="email-notifications"
                        type="checkbox"
                        checked={notificationPrefs.email_enabled}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, email_enabled: e.target.checked }))}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="email-notifications" className="font-medium text-gray-700">
                        Email Notifications
                      </label>
                      <p className="text-gray-500">Receive email notifications for important system events and updates.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="sms-notifications"
                        type="checkbox"
                        checked={notificationPrefs.sms_enabled}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, sms_enabled: e.target.checked }))}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="sms-notifications" className="font-medium text-gray-700">
                        SMS Notifications
                      </label>
                      <p className="text-gray-500">Receive SMS alerts for critical emergency incidents.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="push-notifications"
                        type="checkbox"
                        checked={notificationPrefs.push_enabled}
                        onChange={async (e) => {
                          const enabled = e.target.checked
                          setNotificationPrefs(prev => ({ ...prev, push_enabled: enabled }))
                          
                          // Actually enable/disable push notifications in browser
                          try {
                            if (enabled) {
                              // Enable push notifications (will request permission if needed)
                              const success = await pushNotificationService.enable()
                              if (!success) {
                                // If enable failed, revert checkbox
                                setNotificationPrefs(prev => ({ ...prev, push_enabled: false }))
                                setError('Failed to enable push notifications. Please check browser permissions.')
                              } else {
                                // Save preference after successful enable
                                await handleSaveNotificationPreferences()
                              }
                            } else {
                              // Disable push notifications
                              await pushNotificationService.unsubscribe()
                              // Save preference after disabling
                              await handleSaveNotificationPreferences()
                            }
                          } catch (err: any) {
                            console.error('Push notification toggle error:', err)
                            // Revert checkbox on error
                            setNotificationPrefs(prev => ({ ...prev, push_enabled: !enabled }))
                            setError(err.message || 'Failed to toggle push notifications')
                          }
                        }}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="push-notifications" className="font-medium text-gray-700">
                        Push Notifications
                      </label>
                      <p className="text-gray-500">Receive browser push notifications for real-time updates.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="incident-alerts"
                        type="checkbox"
                        checked={notificationPrefs.incident_alerts}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, incident_alerts: e.target.checked }))}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="incident-alerts" className="font-medium text-gray-700">
                        Incident Alerts
                      </label>
                      <p className="text-gray-500">Get notified when new incidents are reported.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="status-updates"
                        type="checkbox"
                        checked={notificationPrefs.status_updates}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, status_updates: e.target.checked }))}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="status-updates" className="font-medium text-gray-700">
                        Status Updates
                      </label>
                      <p className="text-gray-500">Receive notifications when incident status changes.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium">Security Settings</h2>
                
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-base font-medium mb-4">Change Password</h3>
                  {passwordError && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3">
                      <p className="text-sm text-red-700">{passwordError}</p>
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-3">
                      <p className="text-sm text-green-700">Password changed successfully!</p>
                    </div>
                  )}
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label htmlFor="current-password" className="block text-sm font-medium text-gray-700">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="current-password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="new-password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black"
                        required
                        minLength={6}
                      />
                      <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirm-password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black"
                        required
                        minLength={6}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordLoading ? (
                        <LoadingSpinner size="sm" color="text-white" />
                      ) : (
                        "Update Password"
                      )}
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="text-base font-medium mb-4">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-500 mb-4">Two-factor authentication coming soon</p>
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="enable-2fa"
                        type="checkbox"
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                        disabled
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="enable-2fa" className="font-medium text-gray-700">
                        Enable Two-Factor Authentication
                      </label>
                      <p className="text-gray-500">Add an extra layer of security to your account by requiring both your password and authentication code.</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <PinManagement />
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-base font-medium mb-4">Session Management</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Current Session</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {user?.email || 'Loading...'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Active now
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-600">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm text-gray-600">
                        Sign out of this session to require password on next login
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await supabase.auth.signOut()
                          window.location.href = '/login'
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
