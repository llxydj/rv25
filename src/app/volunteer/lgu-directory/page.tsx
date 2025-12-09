"use client"

import { useEffect, useState } from "react"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"

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
    <VolunteerLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Emergency Contacts</h1>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {contacts.map(c => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2">
              <div className="font-medium text-gray-900 dark:text-white">{c.agency_name}</div>
              {c.contact_person && (
                <div className="text-sm text-gray-600 dark:text-gray-400">Contact: {c.contact_person}</div>
              )}
              <div className="flex items-center justify-between pt-2">
                <a href={`tel:${c.contact_number}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{c.contact_number}</a>
                <a href={`tel:${c.contact_number}`} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-sm font-medium touch-manipulation">Call Now</a>
              </div>
            </div>
          ))}
          {!contacts.length && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              {loading ? 'Loading...' : 'No contacts available'}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Agency</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Contact Person</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Number</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {contacts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{c.agency_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{c.contact_person || '—'}</td>
                  <td className="px-4 py-2 text-sm">
                    <a href={`tel:${c.contact_number}`} className="text-blue-600 dark:text-blue-400 hover:underline">{c.contact_number}</a>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <a href={`tel:${c.contact_number}`} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors">Call Now</a>
                  </td>
                </tr>
              ))}
              {!contacts.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">{loading ? 'Loading...' : 'No contacts available'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </VolunteerLayout>
  )
}
