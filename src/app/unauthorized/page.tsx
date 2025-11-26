"use client"

import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Unauthorized</h1>
        <p className="text-gray-600 text-sm">
          You don't have access to this page. If you're a resident signing in with Google for the first time,
          please complete your profile first.
        </p>
        <div className="flex gap-2 justify-center">
          <Link href="/resident/register-google" className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">
            Complete Resident Registration
          </Link>
          <Link href="/login" className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
