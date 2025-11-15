"use client"

import { useState } from "react"
import FeedbackRating from "@/components/feedback-rating"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Star, ThumbsUp, AlertTriangle } from "lucide-react"

export default function FeedbackTestPage() {
  const [submittedFeedback, setSubmittedFeedback] = useState<any>(null)
  const [showDemo, setShowDemo] = useState(false)

  const handleFeedbackSubmit = (feedback: any) => {
    setSubmittedFeedback(feedback)
    console.log('Feedback submitted:', feedback)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Feedback & Rating System Test</h1>
          <p className="text-gray-600">Test the feedback and rating mechanism for incident responses.</p>
        </div>

        {/* Demo Toggle */}
        <div className="mb-6">
          <Button 
            onClick={() => setShowDemo(!showDemo)}
            className="mb-4"
          >
            {showDemo ? "Hide Demo" : "Show Demo"}
          </Button>
        </div>

        {showDemo && (
          <div className="space-y-6">
            {/* Sample Incident Card */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Sample Incident Report</h2>
                  <p className="text-gray-600">Fire Emergency - Zone 5</p>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Resolved
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Reported</p>
                  <p className="text-sm text-gray-600">March 20, 2024 - 2:30 PM</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Resolved</p>
                  <p className="text-sm text-gray-600">March 20, 2024 - 3:45 PM</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Response Time</p>
                  <p className="text-sm text-gray-600">1 hour 15 minutes</p>
                </div>
              </div>

              <p className="text-gray-700 mb-4">
                Fire emergency reported in Zone 5. Emergency responders arrived quickly and successfully 
                extinguished the fire. No injuries reported. Property damage was minimal.
              </p>
            </Card>

            {/* Feedback Component */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Your Experience</h3>
              <p className="text-gray-600 mb-6">
                Help us improve our emergency response by rating your experience with this incident.
              </p>
              
              <FeedbackRating 
                incidentId="sample-incident-123"
                onFeedbackSubmit={handleFeedbackSubmit}
              />
            </Card>

            {/* Submitted Feedback Display */}
            {submittedFeedback && (
              <Card className="p-6 bg-green-50 border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Feedback Submitted Successfully!
                </h3>
                
                <div className="space-y-3">
                  {submittedFeedback.rating > 0 && (
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 mr-2" />
                      <span className="text-sm text-gray-700">
                        Rating: {submittedFeedback.rating}/5 stars
                      </span>
                    </div>
                  )}
                  
                  {submittedFeedback.thumbsUp !== null && (
                    <div className="flex items-center">
                      {submittedFeedback.thumbsUp ? (
                        <ThumbsUp className="h-4 w-4 text-green-600 mr-2" />
                      ) : (
                        <ThumbsUp className="h-4 w-4 text-red-600 mr-2 rotate-180" />
                      )}
                      <span className="text-sm text-gray-700">
                        Quick Feedback: {submittedFeedback.thumbsUp ? "Satisfied" : "Not Satisfied"}
                      </span>
                    </div>
                  )}
                  
                  {submittedFeedback.comment && (
                    <div className="flex items-start">
                      <AlertTriangle className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <div>
                        <span className="text-sm text-gray-700">Comment:</span>
                        <p className="text-sm text-gray-600 mt-1">{submittedFeedback.comment}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Feature Overview */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Feedback System Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">⭐ Star Rating System</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 1-5 star rating scale</li>
                <li>• Visual feedback with hover effects</li>
                <li>• Descriptive labels (Poor, Fair, Good, Very Good, Excellent)</li>
                <li>• Required for meaningful feedback</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">👍 Quick Feedback</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Thumbs up/down for quick responses</li>
                <li>• Visual state indicators</li>
                <li>• Alternative to detailed rating</li>
                <li>• Mobile-friendly touch targets</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">💬 Comment System</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Optional detailed feedback</li>
                <li>• Multi-line text input</li>
                <li>• Character limit considerations</li>
                <li>• Placeholder guidance text</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📱 Mobile Optimized</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Touch-friendly interface</li>
                <li>• Responsive design</li>
                <li>• Works on all screen sizes</li>
                <li>• Accessible for all users</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Testing Instructions */}
        <div className="mt-8">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Test</h3>
            <ol className="space-y-2 text-sm text-blue-800">
              <li>1. Click "Show Demo" to see the feedback component</li>
              <li>2. Try rating with stars (click on different star levels)</li>
              <li>3. Test the thumbs up/down buttons</li>
              <li>4. Add a comment in the text area</li>
              <li>5. Click "Submit Feedback" to see the results</li>
              <li>6. Check the browser console for the feedback data</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
