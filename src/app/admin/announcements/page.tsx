"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, Calendar, CheckCircle, Edit3, MapPin, Plus, Trash2, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Announcement = {
  id: string
  title: string
  content: string
  type: 'TRAINING' | 'MEETING' | 'ALERT' | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  location?: string | null
  date?: string | null
  time?: string | null
  requirements?: string[] | null
  created_at: string
  created_by?: string | null
  published?: boolean
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState({
    title: "",
    content: "",
    type: "GENERAL" as Announcement['type'],
    priority: "LOW" as Announcement['priority'],
    location: "",
    date: "",
    time: "",
    requirements: "",
  })

  const fetchList = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      const res = await fetch('/api/announcements', { 
        cache: 'no-store',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Failed to fetch')
      setItems(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch announcements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  const resetForm = () => {
    setForm({ title: "", content: "", type: "GENERAL", priority: "LOW", location: "", date: "", time: "", requirements: "" })
    setEditing(null)
  }

  const openCreate = () => { resetForm(); setShowForm(true) }
  const openEdit = (a: Announcement) => {
    setEditing(a)
    setForm({
      title: a.title,
      content: a.content,
      type: a.type,
      priority: a.priority,
      location: a.location || "",
      date: a.date || "",
      time: a.time || "",
      requirements: (a.requirements || []).join(', '),
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      priority: form.priority,
      location: form.location.trim() || null,
      date: form.date || null,
      time: form.time || null,
      requirements: form.requirements
        ? form.requirements.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      const res = await fetch('/api/admin/announcements', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.success) {
        const issues = json.issues ? `\nDetails: ${JSON.stringify(json.issues)}` : ''
        throw new Error(`${json.message || 'Failed to save'}${issues}`)
      }
      setShowForm(false)
      resetForm()
      fetchList()
    } catch (e: any) {
      setError(e?.message || 'Failed to save announcement')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      const res = await fetch('/api/admin/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ id }),
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Failed to delete')
      fetchList()
    } catch (e: any) {
      setError(e?.message || 'Failed to delete announcement')
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Announcements</h1>
            <p className="text-gray-600">Create and manage system announcements.</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2"/> New Announcement
          </button>
        </div>

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

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">When/Where</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map(a => (
                  <tr key={a.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{a.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{a.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{a.priority}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        {a.date && (
                          <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{a.date} {a.time}</span>
                        )}
                        {a.location && (
                          <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{a.location}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button onClick={() => openEdit(a)} className="text-blue-600 hover:text-blue-800 inline-flex items-center mr-3"><Edit3 className="h-4 w-4 mr-1"/>Edit</button>
                      <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-800 inline-flex items-center"><Trash2 className="h-4 w-4 mr-1"/>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit' : 'New'} Announcement</h3>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5"/></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Content</label>
                  <textarea className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900" rows={4} required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>
                      {['TRAINING','MEETING','ALERT','GENERAL'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Priority</label>
                    <select className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })}>
                      {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <input type="date" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Time</label>
                    <input type="time" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <input className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900" placeholder="Venue or address" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Requirements (comma-separated)</label>
                  <input className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900" placeholder="e.g., Valid ID, Medical Certificate" value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 border rounded-md">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">{editing ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}



