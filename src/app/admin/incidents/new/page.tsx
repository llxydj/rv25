"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { createIncident } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { AlertTriangle } from "lucide-react"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"

const INCIDENT_TYPES = [
  "FIRE",
  "FLOOD",
  "EARTHQUAKE",
  "MEDICAL EMERGENCY",
  "CRIME",
  "TRAFFIC ACCIDENT",
  "FALLEN TREE",
  "POWER OUTAGE",
  "WATER OUTAGE",
  "LANDSLIDE",
  "OTHER",
]

export default function AdminCreateIncidentPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    incidentType: "",
    description: "",
    address: "",
    barangay: "",
    priority: "3",
  })
  const [location, setLocation] = useState<[number, number]>(TALISAY_CENTER)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [barangays, setBarangays] = useState<string[]>([])

  useEffect(() => {
    // Fetch barangays from the database or use hardcoded list
    const fetchBarangays = async () => {
      try {
        const { data } = await fetch("/api/barangays").then((res) => res.json())
        if (data) {
          const barangayNames = data.map((b: any) => b.name)
          setBarangays(barangayNames)
        }
      } catch (err) {
        console.error("Error fetching barangays:", err)
        // Fallback to hardcoded list if API fails
        const fallbackBarangays = [
          "ZONE 1", "ZONE 2", "ZONE 3", "ZONE 4", "ZONE 5",
          "ZONE 6", "ZONE 7", "ZONE 8", "ZONE 9", "ZONE 10",
          "ZONE 11", "ZONE 12", "ZONE 13", "ZONE 14", "ZONE 15",
          "ZONE 16", "ZONE 17", "ZONE 18", "ZONE 19", "ZONE 20",
          "CONCEPCION", "CABATANGAN", "MATAB-ANG", "BUBOG",
          "DOS HERMANAS", "EFIGENIO LIZARES", "KATILINGBAN",
        ]
        setBarangays(fallbackBarangays)
      }
    }

    fetchBarangays()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleMapClick = (lat: number, lng: number) => {
    setLocation([lat, lng])
    
    // Check if location is within Talisay City
    if (!isWithinTalisayCity(lat, lng)) {
      setError("Selected location is outside Talisay City. You can only report incidents within Talisay City.")
    } else {
      setError(null)
    }
  }

  const validateForm = () => {
    if (!formData.incidentType) {
      setError("Please select an incident type")
      return false
    }

    if (!formData.description) {
      setError("Please provide a description")
      return false
    }

    if (!formData.address) {
      setError("Please provide an address")
      return false
    }

    if (!formData.barangay) {
      setError("Please select a barangay")
      return false
    }

    if (!location) {
      setError("Please select a location on the map")
      return false
    }

    if (!isWithinTalisayCity(location[0], location[1])) {
      setError("Selected location is outside Talisay City. You can only report incidents within Talisay City.")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError("You must be logged in to create an incident")
      return
    }

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const result = await createIncident(
        user.id, // Admin is the reporter
        formData.incidentType,
        formData.description,
        location[0],
        location[1],
        formData.address,
        formData.barangay,
        null, // No photo for admin-created incidents
        Number.parseInt(formData.priority),
      )

      if (!result.success) {
        setError(result.message || "Failed to create incident")
        return
      }

      // Redirect to incidents list with success message
      router.push("/admin/incidents?success=Incident created successfully")
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-black">Create New Incident</h1>
          <p className="text-gray-600 mt-1">Add a new incident to the system.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-black">Incident Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="incidentType" className="block text-sm font-medium text-gray-700">
                  Incident Type *
                </label>
                <select
                  id="incidentType"
                  name="incidentType"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                  value={formData.incidentType}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select Incident Type</option>
                  {INCIDENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                  value={formData.priority}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="1">1 - Critical (Life-threatening)</option>
                  <option value="2">2 - High (Urgent assistance needed)</option>
                  <option value="3">3 - Medium (Standard response)</option>
                  <option value="4">4 - Low (Non-urgent)</option>
                  <option value="5">5 - Information only</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                  placeholder="Please describe what happened..."
                  value={formData.description}
                  onChange={handleChange}
                  disabled={loading}
                ></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-black">Location</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address *
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                  placeholder="Street address"
                  value={formData.address}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">
                  Barangay *
                </label>
                <select
                  id="barangay"
                  name="barangay"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                  value={formData.barangay}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select Barangay</option>
                  {barangays.map((barangay) => (
                    <option key={barangay} value={barangay}>
                      {barangay}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pin Location on Map *
                </label>
                <div className="h-64 rounded-md overflow-hidden border border-gray-300">
                  <MapComponent
                    center={location}
                    zoom={14}
                    onMapClick={handleMapClick}
                    markers={location ? [
                      {
                        id: "incident-location",
                        position: location,
                        title: "Incident Location",
                        status: "PENDING",
                      },
                    ] : []}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">Click on the map to set the incident location</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading}
            >
              {loading ? <LoadingSpinner size="sm" /> : "Create Incident"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
} 