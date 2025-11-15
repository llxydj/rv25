"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AuthLayout } from '@/components/layout/auth-layout'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOW = ['pdf','doc','docx','png','jpg','jpeg']

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/admin-documents', { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: 'include', cache: 'no-store' })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Failed to load')
      setDocs(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const viewDoc = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/admin-documents?id=${encodeURIComponent(id)}&signed=1`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.success || !json.url) throw new Error(json.message || 'Failed to get signed URL')
      window.open(json.url, '_blank')
    } catch (e: any) {
      setError(e?.message || 'Failed to open document')
    }
  }

  useEffect(() => { load() }, [])

  const upload = async () => {
    try {
      setUploading(true)
      setError(null)
      if (!file) { setError('Select a file'); return }
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !ALLOW.includes(ext)) { setError('File type not allowed'); return }
      if (file.size > MAX_FILE_SIZE_BYTES) { setError('File too large (max 10MB)'); return }

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin-documents', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: 'include' })
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

  const removeDoc = async (id: string) => {
    if (!confirm('Delete this document?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/admin-documents?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: 'include' })
      const json = await res.json()
      if (!json.success) { setError(json.message || 'Delete failed'); return }
      await load()
    } catch (e: any) {
      setError(e?.message || 'Delete failed')
    }
  }

  // Get file type icon
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return '📄'
      case 'doc':
      case 'docx':
        return '📝'
      case 'png':
      case 'jpg':
      case 'jpeg':
        return '🖼️'
      default:
        return '📁'
    }
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Admin Documents</h1>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md" role="alert" aria-live="polite">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        )}

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} className="flex-1" />
            <Button onClick={upload} disabled={uploading || !file} className="w-full sm:w-auto">
              {uploading ? (
                <>
                  <LoadingSpinner size="sm" color="text-white" className="mr-2" />
                  Uploading...
                </>
              ) : 'Upload'}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Allowed: PDF, DOC, DOCX, PNG, JPG. Max 10MB.</p>
        </Card>

        <Card className="p-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <LoadingSpinner size="md" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">📁</div>
              <p className="text-gray-600">No documents yet.</p>
              <p className="text-sm text-gray-500 mt-1">Upload your first document using the form above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {docs.map((d:any) => (
                  <div key={d.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0 mt-1">
                        {getFileIcon(d.file_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" title={d.file_name}>{d.file_name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatFileSize(d.size_bytes)} • {new Date(d.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={()=>viewDoc(d.id)}
                          className="h-8 text-xs"
                        >
                          View
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={()=>removeDoc(d.id)}
                          className="h-8 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </AuthLayout>
  )
}
