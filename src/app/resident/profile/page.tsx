"use client"
import { useEffect, useState } from "react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { AlertTriangle, Camera, CheckCircle, AlertTriangle as Lock, Mail, MapPin, Phone, Save, User } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"

export default function ResidentProfilePage() {
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<"personal" | "security">("personal")
  const [barangaysLoading, setBarangaysLoading] = useState(true)
  
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

  // ✅ FETCH BARANGAYS - EXACTLY LIKE REGISTRATION PAGE
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        setBarangaysLoading(true)
        const res = await fetch('/api/barangays')
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        
        const json = await res.json()
        
        // Handle both response formats: {data: [...]} or direct array
        const barangayList = Array.isArray(json?.data) ? json.data : []
        
        if (barangayList.length === 0) {
          console.warn("No barangays returned from API")
        }
        
        setBarangays(barangayList)
        console.log("✅ Barangays loaded successfully:", barangayList.length, "items")
      } catch (error) {
        console.error("❌ Failed to fetch barangays:", error)
        setBarangays([])
      } finally {
        setBarangaysLoading(false)
      }
    }
    
    fetchBarangays()
  }, [])

  // ✅ LOAD USER DATA - ONLY AFTER BARANGAYS ARE LOADED
  useEffect(() => {
    if (user && barangays.length > 0) {
      setFirstName(user.first_name || "")
      setLastName(user.last_name || "")
      setEmail(user.email || "")
      setPhoneNumber(user.phone_number || "")
      setAddress(user.address || "")
      
      // ✅ CRITICAL: Match the exact name from barangays list
      const userBarangay = user.barangay || ""
      const validBarangay = barangays.find(b => b.name === userBarangay)
      
      if (validBarangay) {
        setBarangay(validBarangay.name)
        console.log("✅ User barangay found and set:", validBarangay.name)
      } else if (userBarangay) {
        console.warn("⚠️ User barangay not in list:", userBarangay)
        setBarangay(userBarangay) // Still set it, but warn
      } else {
        setBarangay("")
      }
    }
  }, [user, barangays])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    // ✅ VALIDATION: Ensure selected barangay exists in database
    const selectedBarangay = barangays.find(b => b.name === barangay)
    if (!selectedBarangay && barangay) {
      setSaveError("Invalid barangay selected. Please choose from the list.")
      return
    }
    
    try {
      setSaveLoading(true)
      setSaveError(null)
      setSaveSuccess(false)
      
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          address: address,
          barangay: barangay // ✅ Store exactly as displayed (matches DB)
        })
        .eq('id', user.id)
      
      if (error) {
        console.error("Supabase update error:", error)
        throw new Error(error.message)
      }
      
      console.log("✅ Profile saved successfully")
      await refreshUser()
      setSaveSuccess(true)
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false)
      }, 3000)
    } catch (error: any) {
      console.error("❌ Save error:", error)
      setSaveError(error.message || "Failed to save profile")
    } finally {
      setSaveLoading(false)
    }
  }
  
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    // Validation
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
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      // Clear password fields
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      
      setPasswordSuccess(true)
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setPasswordSuccess(false)
      }, 3000)
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password")
    } finally {
      setPasswordLoading(false)
    }
  }

  if (!user || barangaysLoading) {
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
          <h1 className="text-2xl font-bold text-black">My Profile</h1>
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("personal")}
              className={`px-4 py-4 text-sm font-medium flex items-center ${
                activeTab === "personal"
                  ? "text-red-600 border-b-2 border-red-500"
                  : "text-gray-500 hover:text-red-600"
              }`}
            >
              <User className="mr-2 h-5 w-5" />
              Personal Information
            </button>
            
            <button
              onClick={() => setActiveTab("security")}
              className={`px-4 py-4 text-sm font-medium flex items-center ${
                activeTab === "security"
                  ? "text-red-600 border-b-2 border-red-500"
                  : "text-gray-500 hover:text-red-600"
              }`}
            >
              <Lock className="mr-2 h-5 w-5" />
              Security
            </button>
          </div>
          <div className="p-6">
            {activeTab === "personal" && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {saveSuccess && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-4">
                    <div className="flex">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div className="ml-3">
                        <p className="text-sm text-green-700">Profile updated successfully!</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {saveError && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <div className="ml-3">
                        <p className="text-sm text-red-700">{saveError}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-200">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-3xl font-bold overflow-hidden">
                      {firstName && lastName ? `${firstName[0]}${lastName[0]}` : "R"}
                    </div>
                    <button 
                      type="button"
                      className="absolute bottom-0 right-0 rounded-full bg-gray-100 p-2 shadow hover:bg-gray-200"
                    >
                      <Camera className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                  
                  <div>
                    <h2 className="text-lg font-medium">
                      {firstName} {lastName}
                    </h2>
                    <p className="text-sm text-gray-500">Resident</p>
                    <p className="text-sm text-gray-500 mt-1 flex items-center">
                      <MapPin className="h-4 w-4 mr-1" /> {barangay || "No barangay set"}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
                      First Name
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="pl-10 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-black"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">
                      Last Name
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="pl-10 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-black"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        className="pl-10 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 focus:outline-none sm:text-sm text-black"
                        disabled
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed. Contact support for assistance.</p>
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="pl-10 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-black"
                      />
                    </div>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="pl-10 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-black"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">
                      Barangay
                    </label>
                    <select
                      id="barangay"
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-black"
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
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
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
                  <div className="bg-green-50 border-l-4 border-green-500 p-4">
                    <div className="flex">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div className="ml-3">
                        <p className="text-sm text-green-700">Password changed successfully!</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {passwordError && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <div className="ml-3">
                        <p className="text-sm text-red-700">{passwordError}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium text-gray-700">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-black"
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
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-black"
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-black"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Password Requirements</h3>
                  <ul className="text-xs text-gray-500 list-disc pl-5 space-y-1">
                    <li>Minimum 6 characters long</li>
                    <li>Include both letters and numbers for stronger security</li>
                    <li>Avoid using easily guessable information (birthdays, names, etc.)</li>
                  </ul>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
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
    </ResidentLayout>
  )
}