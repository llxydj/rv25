"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, Edit, Trash2, Phone, Plus, X } from "lucide-react"

interface LguContact {
  id: string
  agency_name: string | null
  contact_person: string | null
  contact_number: string
  notes: string | null
  created_at: string
  updated_at: string
}

export default function AdminLguContactsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<LguContact[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    id: "",
    agency_name: "",
    contact_person: "",
    contact_number: "",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setForm({ id: "", agency_name: "", contact_person: "", contact_number: "", notes: "" })
    setShowForm(false)
  }

  const loadContacts = async () => {
    try {
      setLoading(true)
      setError(null)
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
      setError(null)
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
        }),
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

  const startCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const startEdit = (c: LguContact) => {
    setForm({
      id: c.id,
      agency_name: c.agency_name || "",
      contact_person: c.contact_person || "",
      contact_number: c.contact_number,
      notes: c.notes || "",
    })
    setShowForm(true)
  }

  const remove = async (id: string) => {
    if (!user?.id) return
    if (!confirm("Delete this contact?")) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/admin/lgu-contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: user.id, id }),
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
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">LGU Contacts</h1>
            <p className="text-sm text-gray-600 mt-1">Manage local government unit contact information</p>
          </div>
          <Button onClick={startCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2"/> Add Contact
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Desktop Table View */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No contacts yet</p>
                <Button onClick={startCreate} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2"/> Add First Contact
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agency</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Person</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {contacts.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.agency_name || "—"}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{c.contact_person || "—"}</td>
                        <td className="px-6 py-4 text-sm">
                          <a
                            href={`tel:${c.contact_number}`}
                            className="text-blue-600 hover:text-blue-800 font-mono"
                          >
                            {c.contact_number}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                              <Edit className="h-4 w-4 mr-1"/>Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => remove(c.id)} className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4 mr-1"/>Delete
                            </Button>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" asChild>
                              <a href={`tel:${c.contact_number}`}>
                                <Phone className="h-4 w-4 mr-1"/>Call
                              </a>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex justify-center">
                  <LoadingSpinner size="lg" />
                </div>
              </CardContent>
            </Card>
          ) : contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 mb-4">No contacts yet</p>
                <Button onClick={startCreate} variant="outline">
                  <Plus className="h-4 w-4 mr-2"/> Add First Contact
                </Button>
              </CardContent>
            </Card>
          ) : (
            contacts.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{c.agency_name || "Unnamed Agency"}</CardTitle>
                      {c.contact_person && (
                        <CardDescription className="mt-1">{c.contact_person}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(c.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contact Number</p>
                      <a
                        href={`tel:${c.contact_number}`}
                        className="text-blue-600 hover:text-blue-800 font-mono text-lg font-semibold"
                      >
                        {c.contact_number}
                      </a>
                    </div>
                    {c.notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Notes</p>
                        <p className="text-sm text-gray-700">{c.notes}</p>
                      </div>
                    )}
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white" asChild>
                      <a href={`tel:${c.contact_number}`}>
                        <Phone className="h-4 w-4 mr-2"/>Call Now
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{form.id ? "Edit Contact" : "Add Contact"}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    <X className="h-5 w-5"/>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Agency Name</label>
                      <Input
                        value={form.agency_name}
                        onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                      <Input
                        value={form.contact_person}
                        onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                      <Input
                        value={form.contact_number}
                        onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <Input
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                      {loading ? "Saving..." : (form.id ? "Update" : "Add")} Contact
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}