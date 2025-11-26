"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Mail, Phone, ArrowLeft, Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function AdminBarangayUserDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return
      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabase
          .from("users")
          .select("id, email, first_name, last_name, phone_number, barangay, city, province, created_at")
          .eq("id", id as string)
          .single()

        if (error) throw error
        setUser(data)
      } catch (err: any) {
        setError(err.message || "Failed to fetch user")
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [id])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size="lg" text="Loading barangay user..." />
        </div>
      </AdminLayout>
    )
  }

  if (error || !user) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </button>
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <p className="text-sm text-red-700">{error || "Barangay user not found."}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-sm text-gray-600">Barangay {user.barangay}</p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-black">Contact</h2>
            <div className="space-y-3 text-gray-800">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span>{user.phone_number || "-"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-black">Location</h2>
            <div className="space-y-3 text-gray-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span>{user.barangay}, {user.city || "TALISAY CITY"}, {user.province || "NEGROS OCCIDENTAL"}</span>
              </div>
              <div className="text-sm text-gray-500">
                Joined {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}


