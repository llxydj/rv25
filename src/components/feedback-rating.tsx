"use client"

import { useState, useEffect } from "react"
import { Star, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent } from "@/components/ui/card"

interface FeedbackRatingProps {
  incidentId: string
  onFeedbackSubmit?: (feedback: FeedbackData) => void
}

interface FeedbackData {
  rating: number;
  comment: string;
}

export default function FeedbackRating({ incidentId, onFeedbackSubmit }: FeedbackRatingProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState<any>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const { user } = useAuth();

  // Check for existing feedback
  useEffect(() => {
    const checkExistingFeedback = async () => {
      if (!incidentId || !user) return;

      try {
        setLoadingFeedback(true);
        const response = await fetch(`/api/feedback?incident_id=${incidentId}`);
        const result = await response.json();

        if (result.success && result.data) {
          // Find feedback from current user
          const userFeedback = result.data.find((f: any) => f.users?.id === user.id || f.user_id === user.id);
          if (userFeedback) {
            setExistingFeedback(userFeedback);
            setRating(userFeedback.rating);
            setComment(userFeedback.comment || "");
          }
        }
      } catch (err) {
        console.error('Error checking existing feedback:', err);
      } finally {
        setLoadingFeedback(false);
      }
    };

    checkExistingFeedback();
  }, [incidentId, user]);

  const handleSubmit = async () => {
    if (rating === 0) {
      alert("Please provide a rating");
      return;
    }
    // Minimal client-side validation to align with API
    if (rating < 1 || rating > 5) {
      alert("Rating must be between 1 and 5");
      return;
    }

    setIsSubmitting(true);
    try {
      const feedbackData: FeedbackData = {
        rating,
        comment,
      };

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incident_id: incidentId,
          rating: feedbackData.rating,
          comment: feedbackData.comment,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setExistingFeedback(result.data);
        onFeedbackSubmit?.(feedbackData);
        alert("Thank you for your feedback!");
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err?.message || "Failed to submit feedback. Please try again.");
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert("Error submitting feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingFeedback) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center py-4 text-gray-500">Loading...</div>
      </div>
    );
  }

  // Show existing feedback if already submitted
  if (existingFeedback) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">Feedback Submitted</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Rating
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-6 w-6 ${
                      star <= rating
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            </div>

            {comment && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Comments
                </label>
                <div className="bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment}</p>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500">
              Submitted on {new Date(existingFeedback.created_at).toLocaleString()}
              {existingFeedback.updated_at !== existingFeedback.created_at && (
                <span className="ml-2">• Updated on {new Date(existingFeedback.updated_at).toLocaleString()}</span>
              )}
            </div>

            <p className="text-sm text-gray-600 italic">
              Thank you for your feedback! You can update your feedback by submitting again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Rate Your Experience</h3>
      
      {/* Star Rating */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Overall Rating (1-5 stars)
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="focus:outline-none"
            >
              <Star
                className={`h-6 w-6 ${
                  star <= rating
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-sm text-gray-600 mt-1">
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent"}
          </p>
        )}
      </div>

      {/* Comment */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Comments (Optional)
        </label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience or suggestions for improvement..."
          rows={3}
          className="w-full"
        />
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || rating === 0}
        className="w-full"
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        {isSubmitting ? "Submitting..." : "Submit Feedback"}
      </Button>
    </div>
  );
}
