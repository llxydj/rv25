"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"

interface LguContact {
  id: string
  agency_name: string
  contact_person: string | null
  contact_number: string
  notes: string | null
  created_at: string
  updated_at: string
}

export default function AdminLguContactsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<LguContact[]>([])
  const [form, setForm] = useState({
    id: "",
    agency_name: "",
    contact_person: "",
    contact_number: "",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => setForm({ id: "", agency_name: "", contact_person: "", contact_number: "", notes: "" })

  const loadContacts = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/lgu-contacts")
      const json = await res.json()
      if (res.ok && json.success) setContacts(json.data || [])
      else setError(json.message || "Failed to load contacts")
    } catch (e: any) {
      setError(e?.message || "Failed to load contacts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    try {
      setLoading(true)
      const method = form.id ? "PUT" : "POST"
      const res = await fetch("/api/admin/lgu-contacts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: user.id,
          ...(form.id ? { id: form.id } : {}),
          agency_name: form.agency_name.trim(),
          contact_person: form.contact_person?.trim() || null,
          contact_number: form.contact_number.trim(),
          notes: form.notes?.trim() || null,
        })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save")
      resetForm()
      await loadContacts()
    } catch (e: any) {
      setError(e?.message || "Failed to save contact")
    } finally {
      setLoading(false)
    }
  }

  const edit = (c: LguContact) => {
    setForm({
      id: c.id,
      agency_name: c.agency_name,
      contact_person: c.contact_person || "",
      contact_number: c.contact_number,
      notes: c.notes || "",
    })
  }

  const remove = async (id: string) => {
    if (!user?.id) return
    if (!confirm("Delete this contact?")) return
    try {
      setLoading(true)
      const res = await fetch("/api/admin/lgu-contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: user.id, id })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete")
      await loadContacts()
    } catch (e: any) {
      setError(e?.message || "Failed to delete contact")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">LGU Contacts</h1>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agency Name</label>
              <input value={form.agency_name} onChange={e=>setForm(f=>({...f, agency_name: e.target.value}))} className="w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input value={form.contact_person} onChange={e=>setForm(f=>({...f, contact_person: e.target.value}))} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
              <input value={form.contact_number} onChange={e=>setForm(f=>({...f, contact_number: e.target.value}))} className="w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f, notes: e.target.value}))} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
              {form.id ? "Update" : "Add"} Contact
            </button>
            {form.id && (
              <button type="button" onClick={resetForm} className="px-4 py-2 border rounded">Cancel</button>
            )}
          </div>
        </form>

        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact Person</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm">{c.agency_name}</td>
                  <td className="px-4 py-2 text-sm">{c.contact_person || "—"}</td>
                  <td className="px-4 py-2 text-sm">
                    <a href={`tel:${c.contact_number}`} className="text-blue-600 hover:underline">{c.contact_number}</a>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div className="flex gap-2">
                      <button onClick={()=>edit(c)} className="px-3 py-1 border rounded">Edit</button>
                      <button onClick={()=>remove(c.id)} className="px-3 py-1 border rounded text-red-600">Delete</button>
                      <a href={`tel:${c.contact_number}`} className="px-3 py-1 bg-green-600 text-white rounded">Call Now</a>
                    </div>
                  </td>
                </tr>
              ))}
              {!contacts.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-sm">No contacts yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
