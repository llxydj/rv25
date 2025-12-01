"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Calendar, Edit3, MapPin, Plus, Trash2, X, ArrowLeft, Share2 as Facebook, Link as ExternalLink, Star, MessageSquare } from "lucide-react"
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
  facebook_post_url?: string | null
  facebook_embed_data?: any | null
  source_type?: 'MANUAL' | 'FACEBOOK' | null
}

type FeedbackStats = {
  total: number
  average_rating: number
  rating_distribution: Array<{ star: number; count: number }>
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
    facebook_post_url: "",
  })
  const [facebookPreview, setFacebookPreview] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [feedbackStats, setFeedbackStats] = useState<Record<string, FeedbackStats>>({})
  const [loadingFeedback, setLoadingFeedback] = useState<Record<string, boolean>>({})
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null)
  const [feedbackDetails, setFeedbackDetails] = useState<any[]>([])

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

  const fetchFeedbackStats = async (announcementId: string) => {
    try {
      setLoadingFeedback(prev => ({ ...prev, [announcementId]: true }))
      const res = await fetch(`/api/announcements/feedback?announcement_id=${announcementId}`)
      const json = await res.json()
      if (json.success) {
        setFeedbackStats(prev => ({ ...prev, [announcementId]: json.data.statistics }))
        if (showFeedbackModal === announcementId) {
          setFeedbackDetails(json.data.feedback || [])
        }
      }
    } catch (e) {
      console.error('Failed to fetch feedback:', e)
    } finally {
      setLoadingFeedback(prev => ({ ...prev, [announcementId]: false }))
    }
  }

  const openFeedbackModal = async (announcementId: string) => {
    setShowFeedbackModal(announcementId)
    if (!feedbackStats[announcementId]) {
      await fetchFeedbackStats(announcementId)
    } else {
      const res = await fetch(`/api/announcements/feedback?announcement_id=${announcementId}`)
      const json = await res.json()
      if (json.success) {
        setFeedbackDetails(json.data.feedback || [])
      }
    }
  }

  const resetForm = () => {
    setForm({ title: "", content: "", type: "GENERAL", priority: "LOW", location: "", date: "", time: "", requirements: "", facebook_post_url: "" })
    setEditing(null)
    setFacebookPreview(null)
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
      facebook_post_url: a.facebook_post_url || "",
    })
    setFacebookPreview(a.facebook_embed_data || null)
    setShowForm(true)
  }

  const fetchFacebookPreview = async (url: string) => {
    if (!url || !url.includes('facebook.com')) {
      setFacebookPreview(null)
      return
    }

    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/facebook/oembed?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (json.success && json.data) {
        setFacebookPreview(json.data)
      } else {
        setFacebookPreview(null)
      }
    } catch (error) {
      console.error('Failed to fetch Facebook preview:', error)
      setFacebookPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleFacebookUrlChange = (url: string) => {
    setForm({ ...form, facebook_post_url: url })
    // Clear existing timeout
    if ((window as any).facebookPreviewTimeout) {
      clearTimeout((window as any).facebookPreviewTimeout)
    }
    // Debounce preview fetch
    if (url && url.includes('facebook.com')) {
      (window as any).facebookPreviewTimeout = setTimeout(() => {
        fetchFacebookPreview(url)
      }, 1000)
    } else {
      setFacebookPreview(null)
    }
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
      facebook_post_url: form.facebook_post_url.trim() || null,
      source_type: form.facebook_post_url.trim() ? 'FACEBOOK' : 'MANUAL',
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'LOW': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ALERT': return 'bg-red-100 text-red-800'
      case 'TRAINING': return 'bg-blue-100 text-blue-800'
      case 'MEETING': return 'bg-purple-100 text-purple-800'
      case 'GENERAL': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
              <p className="text-sm text-gray-600 mt-1">Create and manage system announcements</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2"/> New Announcement
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
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No announcements yet</p>
                <Button onClick={openCreate} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2"/> Create First Announcement
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">When/Where</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{a.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getTypeColor(a.type)}>{a.type}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getPriorityColor(a.priority)}>{a.priority}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="flex flex-col gap-1">
                            {a.date && (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <Calendar className="h-3 w-3" />
                                {a.date} {a.time}
                              </span>
                            )}
                            {a.location && (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <MapPin className="h-3 w-3" />
                                {a.location}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {loadingFeedback[a.id] ? (
                            <LoadingSpinner size="sm" />
                          ) : feedbackStats[a.id] ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openFeedbackModal(a.id)}
                              className="flex items-center gap-1"
                            >
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span>{feedbackStats[a.id].average_rating.toFixed(1)}</span>
                              <span className="text-gray-500">({feedbackStats[a.id].total})</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchFeedbackStats(a.id)}
                              className="flex items-center gap-1 text-gray-500"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span>View</span>
                            </Button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                              <Edit3 className="h-4 w-4 mr-1"/>Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4 mr-1"/>Delete
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
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 mb-4">No announcements yet</p>
                <Button onClick={openCreate} variant="outline">
                  <Plus className="h-4 w-4 mr-2"/> Create First Announcement
                </Button>
              </CardContent>
            </Card>
          ) : (
            items.map(a => (
              <Card key={a.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{a.title}</CardTitle>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge className={getTypeColor(a.type)}>{a.type}</Badge>
                    <Badge className={getPriorityColor(a.priority)}>{a.priority}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {a.date && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{a.date} {a.time}</span>
                      </div>
                    )}
                    {a.location && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>{a.location}</span>
                      </div>
                    )}
                    {a.content && (
                      <p className="text-gray-700 mt-2 line-clamp-2">{a.content}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{editing ? 'Edit' : 'New'} Announcement</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>
                    <X className="h-5 w-5"/>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value.toUpperCase() })} className="uppercase" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea 
                      className="w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" 
                      rows={4} 
                      required 
                      value={form.content} 
                      onChange={e => setForm({ ...form, content: e.target.value.toUpperCase() })} 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select 
                        className="w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={form.type} 
                        onChange={e => setForm({ ...form, type: e.target.value as any })}
                      >
                        {['TRAINING','MEETING','ALERT','GENERAL'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select 
                        className="w-full border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={form.priority} 
                        onChange={e => setForm({ ...form, priority: e.target.value as any })}
                      >
                        {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <Input placeholder="Venue or address" value={form.location} onChange={e => setForm({ ...form, location: e.target.value.toUpperCase() })} className="uppercase" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Requirements (comma-separated)</label>
                    <Input placeholder="e.g., Valid ID, Medical Certificate" value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value.toUpperCase() })} className="uppercase" />
                  </div>

                  {/* Facebook Post Integration */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Facebook className="h-4 w-4 text-blue-600" />
                      <label className="block text-sm font-medium text-gray-700">Facebook Post URL (Optional)</label>
                    </div>
                    <Input 
                      type="url"
                      placeholder="https://www.facebook.com/..."
                      value={form.facebook_post_url} 
                      onChange={e => handleFacebookUrlChange(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Paste a Facebook post URL to embed it. Leave empty for regular announcement.
                    </p>
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs text-blue-800 dark:text-blue-300 font-medium mb-1">📌 How to get the correct URL:</p>
                      <ol className="text-xs text-blue-700 dark:text-blue-400 list-decimal list-inside space-y-1">
                        <li>Go to the Facebook post</li>
                        <li>Click on the post's <strong>timestamp</strong> (e.g., "2 hours ago")</li>
                        <li>Copy the URL from your browser's address bar</li>
                        <li>Make sure the post is <strong>public</strong> (world icon visible)</li>
                        <li>Don't use share links (facebook.com/share/...)</li>
                      </ol>
                    </div>
                    
                    {/* Facebook Preview */}
                    {loadingPreview && (
                      <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-600">Loading preview...</p>
                      </div>
                    )}
                    {facebookPreview && !loadingPreview && (
                      <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
                        <div className="flex items-center gap-2 mb-2">
                          <Facebook className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Facebook Post Preview</span>
                        </div>
                        <div 
                          className="text-sm text-gray-700"
                          dangerouslySetInnerHTML={{ __html: facebookPreview.html || '' }}
                        />
                        {facebookPreview.url && (
                          <a 
                            href={facebookPreview.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                          >
                            View on Facebook <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                      {editing ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Feedback Modal */}
        {showFeedbackModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    Feedback Details
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowFeedbackModal(null)}>
                    <X className="h-5 w-5"/>
                  </Button>
                </div>
                <CardDescription>
                  {items.find(a => a.id === showFeedbackModal)?.title}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFeedback[showFeedbackModal] ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : feedbackStats[showFeedbackModal] ? (
                  <div className="space-y-6">
                    {/* Statistics */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                              {feedbackStats[showFeedbackModal].average_rating.toFixed(1)}
                            </div>
                            <div className="flex items-center justify-center gap-1 mb-2">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= Math.round(feedbackStats[showFeedbackModal].average_rating)
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="text-sm text-gray-500">
                              Average Rating
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                              {feedbackStats[showFeedbackModal].total}
                            </div>
                            <div className="text-sm text-gray-500">
                              Total {feedbackStats[showFeedbackModal].total === 1 ? 'Rating' : 'Ratings'}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Rating Distribution */}
                    <div>
                      <h4 className="font-semibold mb-3">Rating Distribution</h4>
                      <div className="space-y-2">
                        {feedbackStats[showFeedbackModal].rating_distribution.map(({ star, count }) => {
                          const percentage = feedbackStats[showFeedbackModal].total > 0
                            ? (count / feedbackStats[showFeedbackModal].total) * 100
                            : 0
                          return (
                            <div key={star} className="flex items-center gap-3">
                              <div className="flex items-center gap-1 w-20">
                                <span className="text-sm font-medium">{star}</span>
                                <Star className="h-4 w-4 text-yellow-400" />
                              </div>
                              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-yellow-400"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                                {count} ({percentage.toFixed(0)}%)
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Feedback List */}
                    {feedbackDetails.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">All Feedback</h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {feedbackDetails.map((fb: any) => (
                            <Card key={fb.id} className="bg-gray-50 dark:bg-gray-800">
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map(star => (
                                        <Star
                                          key={star}
                                          className={`h-4 w-4 ${
                                            star <= fb.rating
                                              ? 'fill-yellow-400 text-yellow-400'
                                              : 'text-gray-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {fb.users?.first_name} {fb.users?.last_name}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {new Date(fb.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                {fb.comment && (
                                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                                    {fb.comment}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No feedback yet for this announcement</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}



