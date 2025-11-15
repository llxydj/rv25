"use client"

import React, { useState, useRef } from "react"
import { Camera, Trash2, Upload, User } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string
  onPhotoUpdate: (url: string | null) => void
  userId: string
}

export const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  currentPhotoUrl,
  onPhotoUpdate,
  userId,
}) => {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, or WebP image",
        variant: "destructive",
      })
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      })
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/volunteer-profile-photo', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to upload photo')
      }

      setPhotoUrl(result.data.url)
      onPhotoUpdate(result.data.url)

      toast({
        title: "Photo uploaded",
        description: "Your profile photo has been updated successfully",
        variant: "default",
      })
    } catch (error: any) {
      console.error('Photo upload error:', error)
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload profile photo",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeletePhoto = async () => {
    try {
      setDeleting(true)

      const response = await fetch('/api/volunteer-profile-photo', {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to delete photo')
      }

      setPhotoUrl(undefined)
      onPhotoUpdate(null)

      toast({
        title: "Photo deleted",
        description: "Your profile photo has been removed",
        variant: "default",
      })
    } catch (error: any) {
      console.error('Photo delete error:', error)
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete profile photo",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt="Profile photo"
              width={128}
              height={128}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
              <User className="w-16 h-16 text-blue-600" />
            </div>
          )}
        </div>
        
        {(uploading || deleting) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
            <LoadingSpinner size="md" className="text-white" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || deleting}
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleting}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {photoUrl ? (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Change Photo
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo
            </>
          )}
        </button>

        {photoUrl && (
          <button
            type="button"
            onClick={handleDeletePhoto}
            disabled={uploading || deleting}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center max-w-xs">
        Upload a profile photo (JPEG, PNG, or WebP). Max size: 5MB
      </p>
    </div>
  )
}
