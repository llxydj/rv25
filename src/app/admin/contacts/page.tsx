"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"

// Types should match DB and lib
const CONTACT_TYPES = [
  { value: "emergency", label: "Emergency" },
  { value: "fire", label: "Fire" },
  { value: "police", label: "Police" },
  { value: "medical", label: "Medical" },
  { value: "disaster", label: "Disaster" },
  { value: "utility", label: "Utility" },
  { value: "admin", label: "Admin" },
] as const

interface EmergencyContact {
  id: string
  name: string
  number: string
  type: typeof CONTACT_TYPES[number]["value"]
  priority: number
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AdminContactsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    number: "",
    type: "emergency",
    priority: 1,
    description: ""
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from("emergency_contacts")
          .select("*")
          .order("priority", { ascending: true })
          .order("name", { ascending: true })

        if (error) throw error
        setContacts((data as EmergencyContact[]) || [])
      } catch (e: any) {
        toast({ variant: "destructive", title: "Failed to load contacts", description: e.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts.filter(c => {
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q)
      const matchT = typeFilter === "all" || c.type === typeFilter
      return matchQ && matchT
    })
  }, [contacts, query, typeFilter])

  const startCreate = () => {
    setEditId(null)
    setForm({ name: "", number: "", type: "emergency", priority: 1, description: "" })
    setShowForm(true)
  }

  const startEdit = (c: EmergencyContact) => {
    setEditId(c.id)
    setForm({ name: c.name, number: c.number, type: c.type, priority: c.priority, description: c.description || "" })
    setShowForm(true)
  }

  const save = async () => {
    try {
      setSaving(true)
      if (!form.name || !form.number) {
        toast({ variant: "destructive", title: "Name and number are required" })
        return
      }

      const payload = {
        id: editId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        name: form.name.trim(),
        number: form.number.trim(),
        type: form.type as EmergencyContact["type"],
        priority: Number(form.priority) || 1,
        description: form.description?.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      // Duplicate detection: same name (case-insensitive) and number
      try {
        const { data: dup, error: dupErr } = await supabase
          .from("emergency_contacts")
          .select("id")
          .eq("number", payload.number)
          .ilike("name", payload.name)
          .limit(1)

        if (dupErr) throw dupErr
        if (dup && dup.length > 0 && dup[0].id !== payload.id) {
          toast({ variant: "destructive", title: "Duplicate contact", description: "A contact with the same name and number already exists." })
          return
        }
      } catch (dupCheckErr: any) {
        // Non-blocking: log but proceed to save
        console.warn("Duplicate check failed:", dupCheckErr?.message)
      }

      const { data, error } = await supabase
        .from("emergency_contacts")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single()

      if (error) throw error

      // Update local list
      setContacts(prev => {
        const other = prev.filter(c => c.id !== data.id)
        return [...other, data as EmergencyContact].sort((a, b) => (a.priority - b.priority) || a.name.localeCompare(b.name))
      })

      setShowForm(false)
      setEditId(null)
      toast({ title: editId ? "Contact updated" : "Contact added" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to save", description: e.message })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (c: EmergencyContact) => {
    try {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .update({ is_active: !c.is_active, updated_at: new Date().toISOString() })
        .eq("id", c.id)
        .select()
        .single()
      if (error) throw error
      setContacts(prev => prev.map(x => x.id === c.id ? (data as EmergencyContact) : x))
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to update status", description: e.message })
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency Contacts</h1>
            <p className="text-gray-600">Manage hotlines displayed in the Emergency Call panel. Multiple numbers per agency are supported.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={startCreate} className="bg-blue-600 hover:bg-blue-700 text-white">Add Contact</Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1">
              <Input placeholder="Search name, number, or description..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 w-full md:w-auto">
              <option value="all">All Types</option>
              {CONTACT_TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>
        </Card>

        <Card className="p-4">
          {loading ? (
            <div className="text-gray-600">Loading contacts...</div>
          ) : filtered.length === 0 ? (
            <div className="text-gray-600">No contacts found.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{c.name}</p>
                      <Badge variant="secondary" className="text-xs">{c.type}</Badge>
                      {!c.is_active && (
                        <Badge className="bg-gray-200 text-gray-700 text-xs">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{c.number}</p>
                    {c.description && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{c.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Badge variant="outline" className="text-xs">Priority {c.priority}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(c)}>Edit</Button>
                    <Button size="sm" className={c.is_active ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"} onClick={() => toggleActive(c)}>
                      {c.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {showForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <Card className="bg-white rounded-lg w-full max-w-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{editId ? "Edit Contact" : "Add Contact"}</h3>
                <Button variant="ghost" onClick={() => setShowForm(false)}>Close</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Number</label>
                  <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {CONTACT_TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority (1 = highest)</label>
                  <Input type="number" min={1} max={99} value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white" onClick={save}>{saving ? "Saving..." : (editId ? "Update" : "Create")}</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
