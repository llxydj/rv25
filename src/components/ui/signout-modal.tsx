"use client"

import type React from "react"
import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface SignOutModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  roleLabel?: string
}

export const SignOutModal: React.FC<SignOutModalProps> = ({
  open,
  onConfirm,
  onCancel,
  loading = false,
  roleLabel,
}) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Sign out</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close sign out dialog"
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50 rounded-lg p-1 hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-2">
          <p className="text-sm text-gray-700">
            Are you sure you want to sign out
            {roleLabel ? ` of the ${roleLabel} portal` : ''}?
          </p>
          <p className="text-xs text-gray-500">
            Active incident updates and notifications will stop until you sign in again.
          </p>
        </div>

        <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white min-w-[110px] flex items-center justify-center"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" color="text-white" />
                <span className="ml-2">Signing out...</span>
              </>
            ) : (
              <span>Sign Out</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
