"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { X, Upload as UploadIcon, FileText } from "lucide-react"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOW = ["pdf", "doc", "docx", "png", "jpg", "jpeg"]

type Doc = {
  id: string
  file_name: string
  display_name?: string | null
  mime_type?: string | null
  size_bytes: number
  created_at: string
  folder_id?: string | null
}

const GROUPS = ["Images", "PDFs", "Word Documents", "Others"] as const
type GroupName = typeof GROUPS[number]

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [renamingDoc, setRenamingDoc] = useState<string | null>(null)
  const [newDisplayName, setNewDisplayName] = useState("")
  const [search, setSearch] = useState("")
  const [openGroups, setOpenGroups] = useState<Record<GroupName, boolean>>({
    Images: false,
    PDFs: false,
    "Word Documents": false,
    Others: false,
  })
  const [currentGroup, setCurrentGroup] = useState<GroupName | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [prefetchingGroup, setPrefetchingGroup] = useState<Record<GroupName, boolean>>({
    Images: false,
    PDFs: false,
    "Word Documents": false,
    Others: false,
  })

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ uploaded: string[]; skipped: { name: string; reason: string }[] } | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch("/api/admin-documents", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
        cache: "no-store",
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || "Failed to load")
      setDocs(json.data || [])
    } catch (e: any) {
      setError(e?.message || "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const getExt = (name: string) => name.split(".").pop()?.toLowerCase() || ""
  const isImage = (d: Doc) => {
    const ext = getExt(d.file_name)
    if (d.mime_type?.startsWith("image")) return true
    return ["png", "jpg", "jpeg"].includes(ext)
  }
  const isPdf = (d: Doc) => getExt(d.file_name) === "pdf" || d.mime_type === "application/pdf"
  const isWord = (d: Doc) => ["doc", "docx"].includes(getExt(d.file_name)) || /word/.test(d.mime_type || "")

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((d) => (d.display_name || d.file_name).toLowerCase().includes(q))
  }, [docs, search])

  const grouped = useMemo(() => {
    const groups: Record<GroupName, Doc[]> = {
      Images: [],
      PDFs: [],
      "Word Documents": [],
      Others: [],
    }
    filteredDocs.forEach((d) => {
      if (isImage(d)) groups.Images.push(d)
      else if (isPdf(d)) groups.PDFs.push(d)
      else if (isWord(d)) groups["Word Documents"].push(d)
      else groups.Others.push(d)
    })
    return groups
  }, [filteredDocs])

  const toggleGroup = (g: GroupName) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [g]: !prev[g] }
      setCurrentGroup(next[g] ? g : null)
      return next
    })
  }

  useEffect(() => {
    const groupNames = GROUPS as GroupName[]
    groupNames.forEach((g) => {
      if (!openGroups[g]) return
      if (prefetchingGroup[g]) return
      const imgs = grouped[g].filter((d) => isImage(d))
      if (imgs.length === 0) return
      ;(async () => {
        setPrefetchingGroup((p) => ({ ...p, [g]: true }))
        await Promise.all(
          imgs.map(async (d) => {
            if (signedUrls[d.id]) return
            try {
              const {
                data: { session },
              } = await supabase.auth.getSession()
              const token = session?.access_token
              const res = await fetch(`/api/admin-documents?id=${encodeURIComponent(d.id)}&signed=1`, {
                method: "GET",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: "include",
                cache: "no-store",
              })
              const json = await res.json()
              if (json?.success && json?.url) {
                setSignedUrls((s) => ({ ...s, [d.id]: json.url }))
              }
            } catch (err) {
              // ignore
            }
          })
        )
        setPrefetchingGroup((p) => ({ ...p, [g]: false }))
      })()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGroups, grouped])

  const ensureSignedUrl = async (docId: string) => {
    if (signedUrls[docId]) return signedUrls[docId]
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/admin-documents?id=${encodeURIComponent(docId)}&signed=1`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
        cache: "no-store",
      })
      const json = await res.json()
      if (json?.success && json?.url) {
        setSignedUrls((s) => ({ ...s, [docId]: json.url }))
        return json.url
      }
    } catch (err) {
      // ignore
    }
    return null
  }

  const viewDoc = async (id: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/admin-documents?id=${encodeURIComponent(id)}&signed=1`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
        cache: "no-store",
      })
      const json = await res.json()
      if (!json.success || !json.url) throw new Error(json.message || "Failed to get signed URL")
      window.open(json.url, "_blank")
    } catch (e: any) {
      setError(e?.message || "Failed to open document")
    }
  }

  const upload = async () => {
    setError(null)
    if (!files || files.length === 0) {
      setError("Select at least one file")
      return
    }

    const valid: File[] = []
    const skipped: { name: string; reason: string }[] = []

    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase()
      if (!ext || !ALLOW.includes(ext)) {
        skipped.push({ name: f.name, reason: "File type not allowed" })
        continue
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        skipped.push({ name: f.name, reason: "File too large (max 10MB)" })
        continue
      }
      valid.push(f)
    }

    if (valid.length === 0) {
      setError("No valid files to upload. " + (skipped.length ? `Skipped ${skipped.length} files.` : ""))
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      const form = new FormData()
      valid.forEach((f) => form.append("files", f))

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      const uploadJson = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", "/api/admin-documents", true)
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        xhr.withCredentials = true

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const percent = Math.round((ev.loaded / ev.total) * 100)
            setUploadProgress(percent)
          }
        }

        xhr.onload = () => {
          try {
            const responseText = xhr.responseText || "{}"
            const json = JSON.parse(responseText)
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(json)
            } else {
              reject(new Error(json?.message || `Upload failed (${xhr.status})`))
            }
          } catch (err) {
            reject(err)
          }
        }

        xhr.onerror = () => reject(new Error("Network error during upload"))
        xhr.send(form)
      })

      const json = uploadJson
      if (!json.success) throw new Error(json.message || "Upload failed")

      const uploadedNames: string[] = (json.data && Array.isArray(json.data))
        ? json.data.map((it: any) => it.display_name || it.file_name)
        : valid.map((f) => f.name)

      setUploadResult({ uploaded: uploadedNames, skipped })
      setShowUploadModal(true)

      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ""

      await load()
    } catch (e: any) {
      setError(e?.message || "Upload failed")
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  const removeDoc = async (id: string) => {
    if (!confirm("Delete this document?")) return
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/admin-documents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.message || "Delete failed")
        return
      }
      setSignedUrls((s) => {
        const copy = { ...s }
        delete copy[id]
        return copy
      })
      await load()
    } catch (e: any) {
      setError(e?.message || "Delete failed")
    }
  }

  const startRename = (doc: Doc) => {
    setRenamingDoc(doc.id)
    setNewDisplayName(doc.display_name || doc.file_name)
  }
  const cancelRename = () => {
    setRenamingDoc(null)
    setNewDisplayName("")
  }
  const saveRename = async (id: string) => {
    if (!newDisplayName.trim()) {
      setError("Display name cannot be empty")
      return
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch("/api/admin-documents", {
        method: "PUT",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ id, display_name: newDisplayName.trim() }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.message || "Rename failed")
        return
      }
      setRenamingDoc(null)
      setNewDisplayName("")
      await load()
    } catch (e: any) {
      setError(e?.message || "Rename failed")
    }
  }

  const openPreview = async (d: Doc) => {
    setPreviewLoading(true)
    try {
      const url = await ensureSignedUrl(d.id)
      if (url) setPreviewUrl(url)
      else setError("Failed to load preview")
    } catch (err) {
      setError("Failed to load preview")
    } finally {
      setPreviewLoading(false)
    }
  }
  const closePreview = () => setPreviewUrl(null)

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    switch (ext) {
      case "pdf":
        return "📄"
      case "doc":
      case "docx":
        return "📝"
      case "png":
      case "jpg":
      case "jpeg":
        return "🖼️"
      default:
        return "📁"
    }
  }
  const formatFileSize = (bytes: number) => {
    if (!bytes && bytes !== 0) return ""
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }
  const formatDateTime = (timestamp?: string) => {
    if (!timestamp) return ""
    const d = new Date(timestamp)
    return d.toLocaleString()
  }

  const goHome = () => {
    setCurrentGroup(null)
    setOpenGroups({ Images: false, PDFs: false, "Word Documents": false, Others: false })
  }
  const goDocuments = () => {
    setCurrentGroup(null)
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-3 md:space-y-4">
        {/* Breadcrumb */}
        <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1">
          <button onClick={goHome} className="underline hover:text-gray-700 dark:hover:text-gray-300">
            Home
          </button>
          <span>/</span>
          <button onClick={goDocuments} className="underline hover:text-gray-700 dark:hover:text-gray-300">
            Documents
          </button>
          {currentGroup && (
            <>
              <span>/</span>
              <span className="text-gray-700 dark:text-gray-300">{currentGroup}</span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">Admin Documents</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">
            <span className="hidden sm:inline">Auto groups:</span>
            <span className="text-gray-700 dark:text-gray-300">Images · PDFs · Word Docs · Others</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-800 p-3 md:p-4 rounded-md" role="alert" aria-live="polite">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0">
                <X className="h-4 w-4 md:h-5 md:w-5 text-red-500 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs md:text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="mt-1 text-xs md:text-sm text-red-700 dark:text-red-100">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="flex-shrink-0 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Upload + Search */}
        <Card className="p-3 md:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 items-stretch sm:items-center">
            <div className="flex-1 min-w-0">
              <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Choose Files
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  const selected = e.target.files ? Array.from(e.target.files) : []
                  setFiles(selected)
                }}
                className="w-full text-xs md:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer focus:outline-none file:mr-2 md:file:mr-4 file:py-2 file:px-3 md:file:px-4 file:rounded-l-md file:border-0 file:text-xs md:file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
                aria-label="Choose files to upload"
              />
              {files.length > 0 && (
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
            <Button
              onClick={upload}
              disabled={uploading || files.length === 0}
              className="w-full sm:w-auto whitespace-nowrap text-xs md:text-sm h-9 md:h-10 sm:mt-auto"
            >
              {uploading ? (
                <>
                  <LoadingSpinner size="sm" color="text-white" className="mr-1.5 md:mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadIcon className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>

          <Input
            placeholder="Search by file name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs md:text-sm"
            aria-label="Search documents"
          />
        </Card>

        {/* Upload Progress */}
        {uploading && uploadProgress !== null && (
          <Card className="p-3 md:p-4 border-blue-200 dark:border-blue-800">
            <div className="text-xs md:text-sm text-gray-700 dark:text-gray-300 mb-2">
              Uploading: {uploadProgress}%
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                style={{ width: `${uploadProgress}%` }}
                className="h-2 bg-blue-600 dark:bg-blue-500 transition-all duration-300"
              />
            </div>
          </Card>
        )}

        {/* Groups */}
        {loading ? (
          <Card className="p-4">
            <div className="flex justify-center items-center h-32">
              <LoadingSpinner size="md" />
            </div>
          </Card>
        ) : docs.length === 0 ? (
          <Card className="p-8 md:p-12">
            <div className="text-center">
              <FileText className="h-12 w-12 md:h-16 md:w-16 text-gray-400 dark:text-gray-500 mx-auto mb-3 md:mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 dark:text-white mb-2">
                No documents yet
              </h3>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Upload your first document to get started. Supported formats: PDF, Word, Images
              </p>
            </div>
          </Card>
        ) : (
          GROUPS.map((g) => {
            const list = grouped[g]
            const open = !!openGroups[g]
            return (
              <Card key={g} className="p-3 md:p-4">
                <div className="flex items-center justify-between gap-2 md:gap-4">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g)}
                    className="flex items-center gap-2 md:gap-3 text-left flex-1 min-w-0"
                    aria-expanded={open}
                  >
                    <span className="text-base md:text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <span>{open ? "📂" : "📁"}</span>
                      <span className="truncate">{g}</span>
                    </span>
                    <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                      ({list.length})
                    </span>
                  </button>

                  {prefetchingGroup[g] && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 flex-shrink-0">
                      <LoadingSpinner size="xs" />
                      <span className="hidden sm:inline">Loading…</span>
                    </div>
                  )}
                </div>

                {/* Thumbnail Preview (collapsed) */}
                {!open && list.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {list.slice(0, 8).map((d) => (
                      <div
                        key={d.id}
                        className="flex-shrink-0 w-24 h-20 md:w-28 md:h-24 border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setCurrentGroup(g)
                          setOpenGroups((p) => ({ ...p, [g]: true }))
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setCurrentGroup(g)
                            setOpenGroups((p) => ({ ...p, [g]: true }))
                          }
                        }}
                      >
                        {isImage(d) ? (
                          signedUrls[d.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={signedUrls[d.id]}
                              alt={d.file_name}
                              className="w-full h-full object-cover rounded"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                openPreview(d)
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                              {getFileIcon(d.file_name)}
                            </div>
                          )
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-600 dark:text-gray-300">
                            <div className="text-xl md:text-2xl">{getFileIcon(d.file_name)}</div>
                            <div className="truncate mt-1 text-[10px] md:text-xs max-w-full px-1">
                              {d.display_name || d.file_name}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {open && list.length === 0 && (
                  <div className="mt-4 text-xs md:text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No files in this group.
                  </div>
                )}

                {/* File List (expanded) */}
                {open && list.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {list.map((d) => (
                      <div
                        key={d.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow duration-200 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-start gap-2 md:gap-3">
                          {/* Thumbnail */}
                          <div className="w-12 h-10 md:w-16 md:h-12 flex-shrink-0 rounded overflow-hidden bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                            {isImage(d) ? (
                              signedUrls[d.id] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={signedUrls[d.id]}
                                  alt={d.file_name}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => openPreview(d)}
                                />
                              ) : (
                                <button
                                  onClick={() => ensureSignedUrl(d.id)}
                                  className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                  aria-label="Load thumbnail"
                                >
                                  Load
                                </button>
                              )
                            ) : (
                              <div className="text-xl md:text-2xl">{getFileIcon(d.file_name)}</div>
                            )}
                          </div>

                          {/* File Info */}
                          <div className="flex-1 min-w-0">
                            {renamingDoc === d.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={newDisplayName}
                                  onChange={(e) => setNewDisplayName(e.target.value)}
                                  className="h-7 md:h-8 text-xs md:text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveRename(d.id)
                                    if (e.key === "Escape") cancelRename()
                                  }}
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => saveRename(d.id)}
                                    className="h-6 text-[10px] md:text-xs px-2"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelRename}
                                    className="h-6 text-[10px] md:text-xs px-2"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div
                                  className="font-medium text-xs md:text-sm text-gray-900 dark:text-white truncate"
                                  title={d.display_name || d.file_name}
                                >
                                  {d.display_name || d.file_name}
                                </div>
                                <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {formatFileSize(d.size_bytes)} • {formatDateTime(d.created_at)}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Actions */}
                          {renamingDoc !== d.id && (
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => viewDoc(d.id)}
                                className="h-6 md:h-7 text-[10px] md:text-xs px-2"
                              >
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startRename(d)}
                                className="h-6 md:h-7 text-[10px] md:text-xs px-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                              >
                                Rename
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDoc(d.id)}
                                className="h-6 md:h-7 text-[10px] md:text-xs px-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })
        )}

        {/* Upload Result Modal */}
        {showUploadModal && uploadResult && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowUploadModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-4 md:p-6 border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">Upload Result</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 md:space-y-4">
                <div>
                  <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                    Successfully uploaded: <span className="font-medium">{uploadResult.uploaded.length}</span>
                  </p>
                  {uploadResult.uploaded.length > 0 && (
                    <ul className="mt-2 text-xs md:text-sm text-gray-600 dark:text-gray-400 list-disc list-inside max-h-36 overflow-auto">
                      {uploadResult.uploaded.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {uploadResult.skipped.length > 0 && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300">Skipped files:</p>
                    <ul className="mt-2 text-xs md:text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                      {uploadResult.skipped.map((s) => (
                        <li key={s.name}>
                          {s.name} — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowUploadModal(false)} variant="outline" className="text-xs md:text-sm">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={closePreview}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full p-3 md:p-4 border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end mb-2">
                <button
                  onClick={closePreview}
                  aria-label="Close preview"
                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <X className="h-5 w-5 md:h-6 md:w-6" />
                </button>
              </div>
              <div className="flex justify-center items-center">
                {previewLoading ? (
                  <LoadingSpinner size="md" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-[70vh] md:max-h-[80vh] w-auto object-contain rounded"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}