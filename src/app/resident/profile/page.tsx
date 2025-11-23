"use client"
import { useEffect, useState, useRef } from "react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { AlertTriangle, Camera, CheckCircle, Lock, Mail, MapPin, Phone, Save, User, X } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"

export default function ResidentProfilePage() {
  const { user, refreshUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [activeTab, setActiveTab] = useState<"personal" | "security">("personal")
  const [barangaysLoading, setBarangaysLoading] = useState(true)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  
  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [address, setAddress] = useState("")
  const [barangay, setBarangay] = useState("")
  const [barangays, setBarangays] = useState<{ id: number; name: string }[]>([])
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)

  // ✅ HELPER: Auto-uppercase function
  const toUpperCase = (text: string) => text.toUpperCase()

  // ✅ FETCH BARANGAYS
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        setBarangaysLoading(true)
        const res = await fetch('/api/barangays')
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        
        const json = await res.json()
        const barangayList = Array.isArray(json?.data) ? json.data : []
        setBarangays(barangayList)
      } catch (error) {
        console.error("❌ Failed to fetch barangays:", error)
        setBarangays([])
      } finally {
        setBarangaysLoading(false)
      }
    }
    
    fetchBarangays()
  }, [])

  // ✅ LOAD USER DATA & PROFILE IMAGE
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) return
      
      try {
        setLoading(true)
        
        const { data: userData, error } = await supabase
          .from('users')
          .select('first_name, last_name, email, phone_number, address, barangay, profile_image')
          .eq('id', user.id)
          .single()
        
        if (error) throw error
        
        if (userData) {
          setFirstName(userData.first_name || "")
          setLastName(userData.last_name || "")
          setEmail(userData.email || "")
          setPhoneNumber(userData.phone_number || "")
          setAddress(userData.address || "")
          setBarangay(userData.barangay || "")
          
          // Load profile image if exists
          if (userData.profile_image) {
            setProfileImage(userData.profile_image)
          }
        }
      } catch (error) {
        console.error("❌ Failed to load user data:", error)
        showError("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }
    
    loadUserData()
  }, [user?.id])

  // ✅ SHOW ERROR MODAL
  const showError = (message: string) => {
    setErrorMessage(message)
    setShowErrorModal(true)
  }

  // ✅ SHOW SUCCESS MODAL
  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setShowSuccessModal(true)
    setTimeout(() => setShowSuccessModal(false), 3000)
  }

  // ✅ HANDLE PROFILE IMAGE UPLOAD
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError("Please select a valid image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError("Image size must be less than 5MB")
      return
    }

    try {
      setUploadingImage(true)
      
      // Upload to Supabase Storage
      const fileName = `${user.id}-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName)

      // Update user profile with image URL
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_image: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfileImage(publicUrl)
      showSuccess("Profile image updated successfully!")
      
    } catch (error: any) {
      console.error("Image upload error:", error)
      showError(error.message || "Failed to upload image")
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ✅ HANDLE SAVE PROFILE
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    // Validation
    if (!firstName.trim()) {
      showError("First name is required")
      return
    }
    
    if (!lastName.trim()) {
      showError("Last name is required")
      return
    }
    
    if (!address.trim()) {
      showError("Address is required")
      return
    }
    
    if (!barangay) {
      showError("Please select a barangay")
      return
    }
    
    try {
      setSaveLoading(true)
      
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName.trim().toUpperCase(),
          last_name: lastName.trim().toUpperCase(),
          phone_number: phoneNumber.trim(),
          address: address.trim().toUpperCase(),
          barangay: barangay,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (error) {
        console.error("Supabase update error:", error)
        throw new Error(error.message)
      }
      
      await refreshUser()
      showSuccess("Profile updated successfully!")
      
    } catch (error: any) {
      console.error("❌ Save error:", error)
      showError(error.message || "Failed to save profile")
    } finally {
      setSaveLoading(false)
    }
  }
  
  // ✅ HANDLE CHANGE PASSWORD
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    if (!currentPassword) {
      setPasswordError("Current password is required")
      return
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match")
      return
    }
    
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }
    
    try {
      setPasswordLoading(true)
      setPasswordError(null)
      setPasswordSuccess(false)
      
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword
      })
      
      if (signInError) {
        setPasswordError("Current password is incorrect")
        return
      }
      
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      // Clear fields
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordSuccess(true)
      
      setTimeout(() => {
        setPasswordSuccess(false)
      }, 3000)
      
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password")
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading || barangaysLoading) {
    return (
      <ResidentLayout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <LoadingSpinner size="lg" text="Loading profile..." />
        </div>
      </ResidentLayout>
    )
  }

  return (
    <ResidentLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("personal")}
              className={`px-4 py-4 text-sm font-medium flex items-center ${
                activeTab === "personal"
                  ? "text-red-600 dark:text-red-400 border-b-2 border-red-500"
                  : "text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              }`}
            >
              <User className="mr-2 h-5 w-5" />
              Personal Information
            </button>
            
            <button
              onClick={() => setActiveTab("security")}
              className={`px-4 py-4 text-sm font-medium flex items-center ${
                activeTab === "security"
                  ? "text-red-600 dark:text-red-400 border-b-2 border-red-500"
                  : "text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              }`}
            >
              <Lock className="mr-2 h-5 w-5" />
              Security
            </button>
          </div>

          <div className="p-6">
            {activeTab === "personal" && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                
                <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    {profileImage ? (
                      <img 
                        src={profileImage} 
                        alt="Profile" 
                        className="w-24 h-24 rounded-full object-cover bg-red-100"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 text-3xl font-bold">
                        {firstName && lastName ? `${firstName[0]}${lastName[0]}` : "R"}
                      </div>
                    )}
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="absolute bottom-0 right-0 rounded-full bg-gray-100 dark:bg-gray-700 p-2 shadow hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <LoadingSpinner size="xs" color="text-gray-600" />
                      ) : (
                        <Camera className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      )}
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
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                      {firstName} {lastName}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Resident</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                      <MapPin className="h-4 w-4 mr-1" /> {barangay || "No barangay set"}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      First Name *
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        type="text"
                        id="first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(toUpperCase(e.target.value))}
                        className="pl-10 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last Name *
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        type="text"
                        id="last-name"
                        value={lastName}
                        onChange={(e) => setLastName(toUpperCase(e.target.value))}
                        className="pl-10 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        className="pl-10 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none sm:text-sm"
                        disabled
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Email cannot be changed.</p>
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Phone Number
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="pl-10 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address *
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        type="text"
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(toUpperCase(e.target.value))}
                        className="pl-10 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="barangay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Barangay *
                    </label>
                    <select
                      id="barangay"
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      required
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveLoading ? (
                      <LoadingSpinner size="sm" color="text-white" />
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
            
            {activeTab === "security" && (
              <form onSubmit={handleChangePassword} className="space-y-6">
                {passwordSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded">
                    <div className="flex">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div className="ml-3">
                        <p className="text-sm text-green-700 dark:text-green-400">Password changed successfully!</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {passwordError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <div className="ml-3">
                        <p className="text-sm text-red-700 dark:text-red-400">{passwordError}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Current Password *
                    </label>
                    <input
                      type="password"
                      id="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      New Password *
                    </label>
                    <input
                      type="password"
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Confirm New Password *
                    </label>
                    <input
                      type="password"
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password Requirements</h3>
                  <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc pl-5 space-y-1">
                    <li>Minimum 6 characters long</li>
                    <li>Include both letters and numbers for stronger security</li>
                    <li>Avoid using easily guessable information</li>
                  </ul>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordLoading ? (
                      <LoadingSpinner size="sm" color="text-white" />
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-sm w-full text-center space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Success!</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{successMessage}</p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ERROR MODAL */}
      {showErrorModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-sm w-full text-center space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Error</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{errorMessage}</p>
            <button
              onClick={() => setShowErrorModal(false)}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </ResidentLayout>
  )
}