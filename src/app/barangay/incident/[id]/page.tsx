"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, FileText, MapPin, CheckCircle, Clock, User, Phone } from "lucide-react"
import { BarangayLayout } from "@/components/layout/barangay-layout"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"

interface Incident {
  id: string
  incident_type: string
  status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
  address: string
  location_lat: number
  location_lng: number
  description: string
  created_at: string
  updated_at: string
  reference_id: string
  priority: number
  reporter?: {
    first_name: string
    last_name: string
    phone_number: string
    role: string
  }
  assigned_to?: {
    first_name: string
    last_name: string
    phone_number: string
  }
  photo_url?: string
  photo_urls?: string[]
}

export default function BarangayIncidentDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchIncident = async () => {
      if (!user?.barangay) return

      try {
        setLoading(true)
        setError(null)

        // Fetch via API with server-side filtering and RLS enforcement
        const res = await fetch(`/api/incidents/${params.id}?role=BARANGAY&barangay=${encodeURIComponent(user.barangay)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json?.data) {
          throw new Error(json?.message || 'Failed to load incident')
        }

        setIncident(json.data)
      } catch (err: any) {
        console.error("Error fetching incident:", err)
        setError(err.message || "Failed to fetch incident")
      } finally {
        setLoading(false)
      }
    }

    fetchIncident()
  }, [params.id, user?.barangay])

  if (loading) {
    return (
      <BarangayLayout>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size="lg" text="Loading incident details..." />
        </div>
      </BarangayLayout>
    )
  }

  if (error || !incident) {
    return (
      <BarangayLayout>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error || "Incident not found"}</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/barangay/incidents"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Incidents
            </Link>
          </div>
        </div>
      </BarangayLayout>
    )
  }

  const mapMarkers = [
    {
      id: incident.id,
      position: [incident.location_lat, incident.location_lng] as [number, number],
      status: incident.status,
      title: incident.incident_type,
      description: incident.description,
    }
  ]

  return (
    <BarangayLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">Incident Details</h1>
          <div className="mt-4 md:mt-0 flex space-x-2">
            <Link
              href="/barangay/incidents"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Incidents
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{incident.incident_type}</h2>
              <p className="mt-1 text-sm text-gray-500">
                Reference ID: {incident.reference_id} • Reported on {new Date(incident.created_at).toLocaleString()}
              </p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              incident.status === "PENDING"
                ? "bg-yellow-100 text-yellow-800"
                : incident.status === "ASSIGNED"
                  ? "bg-blue-100 text-blue-800"
                  : incident.status === "RESPONDING"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-green-100 text-green-800"
            }`}>
              {incident.status}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Description</h3>
              <p className="mt-2 text-gray-600">{incident.description}</p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900">Priority Level</h3>
              <div className="mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                  {incident.priority === 1 ? "🔴 Critical" : 
                   incident.priority === 2 ? "🟠 High" : 
                   incident.priority === 3 ? "🟡 Medium" : 
                   incident.priority === 4 ? "🟢 Low" : 
                   "ℹ️ Information"}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900">Location</h3>
              <p className="mt-2 text-gray-600">{incident.address}</p>
              <p className="mt-1 text-sm text-gray-500">
                Coordinates: {incident.location_lat.toFixed(6)}, {incident.location_lng.toFixed(6)}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900">Last Updated</h3>
              <p className="mt-2 text-gray-600">{new Date(incident.updated_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Reporter Information */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Reporter Information</h2>
          {incident.reporter ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {incident.reporter.first_name} {incident.reporter.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{incident.reporter.role}</p>
                </div>
              </div>
              {incident.reporter.phone_number && (
                <div className="flex items-start">
                  <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Phone</p>
                    <p className="text-sm text-gray-500">{incident.reporter.phone_number}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No reporter information available</p>
          )}
        </div>

        {/* Assigned Volunteer */}
        {incident.assigned_to && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Assigned Volunteer</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {incident.assigned_to.first_name} {incident.assigned_to.last_name}
                  </p>
                  <p className="text-sm text-gray-500">Volunteer</p>
                </div>
              </div>
              {incident.assigned_to.phone_number && (
                <div className="flex items-start">
                  <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Phone</p>
                    <p className="text-sm text-gray-500">{incident.assigned_to.phone_number}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photo Evidence */}
        {(() => {
          const photoGallery =
            Array.isArray(incident.photo_urls) && incident.photo_urls.length > 0
              ? incident.photo_urls
              : incident.photo_url
                ? [incident.photo_url]
                : []
          if (!photoGallery.length) return null
          return (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">Photo Evidence</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {photoGallery.map((photo, idx) => (
                  <div key={`${photo}-${idx}`} className="flex justify-center">
                    <img
                      src={photo}
                      alt={`Incident photo ${idx + 1}`}
                      className="max-h-96 rounded-lg object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/placeholder-image.png'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Incident Map */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Incident Location</h2>
          <div className="h-[400px] w-full rounded-lg overflow-hidden">
            {typeof window !== 'undefined' && (
              <MapComponent 
                markers={mapMarkers} 
                center={[incident.location_lat, incident.location_lng]} 
                zoom={16} 
                height="400px" 
              />
            )}
          </div>
        </div>
      </div>
    </BarangayLayout>
  )
}