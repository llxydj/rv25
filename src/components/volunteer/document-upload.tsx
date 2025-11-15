"use client"

import React, { useState, useRef, useEffect } from "react"
import { FileText, Trash2, Upload, Download, File, AlertCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useToast } from "@/components/ui/use-toast"
import { VolunteerDocument } from "@/types/volunteer"

interface DocumentUploadProps {
  userId: string
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ userId }) => {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<VolunteerDocument[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDocuments()
  }, [userId])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/volunteer-documents')
      const result = await response.json()

      if (result.success) {
        setDocuments(result.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      })
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/volunteer-documents', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to upload document')
      }

      setDocuments(prev => [result.data, ...prev])

      toast({
        title: "Document uploaded",
        description: `${file.name} has been uploaded successfully`,
        variant: "default",
      })
    } catch (error: any) {
      console.error('Document upload error:', error)
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      setDeletingId(docId)

      const response = await fetch(`/api/volunteer-documents?id=${docId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to delete document')
      }

      setDocuments(prev => prev.filter(doc => doc.id !== docId))

      toast({
        title: "Document deleted",
        description: "The document has been removed successfully",
        variant: "default",
      })
    } catch (error: any) {
      console.error('Document delete error:', error)
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" text="Loading documents..." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
          <p className="text-sm text-gray-500">Upload certificates, IDs, and other documents</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No documents uploaded yet</p>
          <p className="text-xs text-gray-400 mt-1">Upload your certificates and IDs to complete your profile</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <File className="h-8 w-8 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(doc.size_bytes)} • Uploaded {formatDate(doc.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <button
                  type="button"
                  onClick={() => handleDeleteDocument(doc.id)}
                  disabled={deletingId === doc.id}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                  title="Delete document"
                >
                  {deletingId === doc.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Supported formats:</strong> PDF, DOC, DOCX, JPG, PNG (Max 10MB per file)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
