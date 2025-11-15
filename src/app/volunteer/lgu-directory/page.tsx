"use client"

import { useEffect, useState } from "react"
import { AuthLayout } from "@/components/layout/auth-layout"

interface LguContact {
  id: string
  agency_name: string
  contact_person: string | null
  contact_number: string
  notes: string | null
}

export default function VolunteerLguDirectoryPage() {
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<LguContact[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/admin/lgu-contacts')
        const json = await res.json()
        if (!canceled) {
          if (res.ok && json.success) setContacts(json.data || [])
          else setError(json.message || 'Failed to load contacts')
        }
      } catch (e: any) {
        if (!canceled) setError(e?.message || 'Failed to load contacts')
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold">Emergency Contacts</h1>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700">{error}</div>
        )}
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact Person</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm">{c.agency_name}</td>
                  <td className="px-4 py-2 text-sm">{c.contact_person || '—'}</td>
                  <td className="px-4 py-2 text-sm">
                    <a href={`tel:${c.contact_number}`} className="text-blue-600 hover:underline">{c.contact_number}</a>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <a href={`tel:${c.contact_number}`} className="px-3 py-1 bg-green-600 text-white rounded">Call Now</a>
                  </td>
                </tr>
              ))}
              {!contacts.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-sm">{loading ? 'Loading...' : 'No contacts available'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthLayout>
  )
}
