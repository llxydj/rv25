"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { AuthLayout } from "@/components/layout/auth-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

interface VolunteerDocument {
  id: string
  user_id: string
  path: string
  file_name: string
  mime_type?: string | null
  size_bytes: number
  created_at: string
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export default function VolunteerDocumentsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<VolunteerDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/volunteer-documents', {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Failed to load documents')
      setDocs(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onUpload = async () => {
    try {
      setUploading(true)
      setError(null)
      if (!file) {
        setError('Please select a file to upload')
        return
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`File too large. Max size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024*1024))}MB`)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/volunteer-documents', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Upload failed')
      setFile(null)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/volunteer-documents?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Delete failed')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Delete failed')
    }
  }

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-600">Upload and manage your documents. Max size 10MB.</p>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-sm">{error}</div>
        )}

        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            <Button disabled={uploading} onClick={onUpload} className="bg-green-600 hover:bg-green-700 text-white">
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : docs.length === 0 ? (
            <div className="text-gray-600">No documents uploaded yet.</div>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{d.file_name}</p>
                    <p className="text-xs text-gray-600">{(d.size_bytes / 1024).toFixed(1)} KB • {new Date(d.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => onDelete(d.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AuthLayout>
  )
}
