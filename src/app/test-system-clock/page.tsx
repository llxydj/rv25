"use client"

import { SystemClock } from "@/components/system-clock"

export default function TestSystemClockPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-6">System Clock Test</h1>
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <SystemClock className="text-2xl" />
      </div>
      <p className="mt-4 text-gray-600">
        The clock above should update every second with the current date and time, including seconds.
      </p>
    </div>
  )
}