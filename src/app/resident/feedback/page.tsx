"use client"

import React, { useState } from "react"

// Feedback feature is enabled by default
const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_FEEDBACK_ENABLED !== 'false'

export default function ResidentFeedbackPage() {
  const [rating, setRating] = useState<number>(5)
  const [comment, setComment] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      setSubmitting(true)
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to submit feedback')
      setMessage('Thank you for your feedback!')
      setComment("")
      setRating(5)
    } catch (e: any) {
      setMessage(e?.message || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (!FEATURE_ENABLED) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Feedback</h1>
        <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-500 p-3 text-sm text-yellow-800">
          Feedback features are disabled. Enable NEXT_PUBLIC_FEATURE_FEEDBACK_ENABLED to access this page.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Submit Feedback</h1>
      {message && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 text-sm text-blue-800">{message}</div>
      )}
      <form onSubmit={submit} className="space-y-3 bg-white p-4 rounded border">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
          <select value={rating} onChange={e=>setRating(Number(e.target.value))} className="border rounded px-3 py-2">
            {[1,2,3,4,5].map(n=> (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4} className="w-full border rounded px-3 py-2"/>
        </div>
        <button disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  )
}
