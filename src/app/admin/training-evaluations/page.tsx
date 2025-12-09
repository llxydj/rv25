"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/ui/star-rating"
import { BarChart3, TrendingUp, Star, MessageSquare, Users as UsersIcon } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// Trainings feature is enabled by default
const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED !== 'false'

interface Evaluation {
  id: string
  training_id: string
  user_id: string
  rating: number
  comments: string | null
  created_at: string
  user?: {
    first_name: string
    last_name: string
    email: string
  }
  training?: {
    title: string
  }
}

interface Analytics {
  totalEvaluations: number
  averageRating: number
  ratingDistribution: { rating: number; count: number }[]
  recentTrend: 'up' | 'down' | 'stable'
}

export default function AdminTrainingEvaluationsPage() {
  const [items, setItems] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(false)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!FEATURE_ENABLED) return
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch evaluations with user data
        const res = await fetch('/api/training-evaluations?include_user=true', {
          credentials: 'include',
          cache: 'no-store'
        })
        const json = await res.json()
        
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Failed to load training evaluations')
        }
        
        const evaluations = json.data || []
        setItems(evaluations)
        
        // Calculate analytics
        if (evaluations.length > 0) {
          const totalEvaluations = evaluations.length
          const averageRating = evaluations.reduce((sum: number, e: Evaluation) => sum + e.rating, 0) / totalEvaluations
          
          // Rating distribution
          const distribution = [1, 2, 3, 4, 5].map(rating => ({
            rating,
            count: evaluations.filter((e: Evaluation) => e.rating === rating).length
          }))
          
          // Recent trend (last 7 days vs previous 7 days)
          const now = Date.now()
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
          const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000
          
          const recentEvals = evaluations.filter((e: Evaluation) => 
            new Date(e.created_at).getTime() > sevenDaysAgo
          )
          const previousEvals = evaluations.filter((e: Evaluation) => {
            const time = new Date(e.created_at).getTime()
            return time > fourteenDaysAgo && time <= sevenDaysAgo
          })
          
          const recentAvg = recentEvals.length > 0 
            ? recentEvals.reduce((sum: number, e: Evaluation) => sum + e.rating, 0) / recentEvals.length
            : 0
          const previousAvg = previousEvals.length > 0
            ? previousEvals.reduce((sum: number, e: Evaluation) => sum + e.rating, 0) / previousEvals.length
            : 0
          
          const recentTrend = recentAvg > previousAvg ? 'up' : recentAvg < previousAvg ? 'down' : 'stable'
          
          setAnalytics({
            totalEvaluations,
            averageRating,
            ratingDistribution: distribution,
            recentTrend
          })
        } else {
          // No evaluations yet - set default analytics
          setAnalytics({
            totalEvaluations: 0,
            averageRating: 0,
            ratingDistribution: [1, 2, 3, 4, 5].map(r => ({ rating: r, count: 0 })),
            recentTrend: 'stable'
          })
        }
      } catch (e: any) {
        console.error('Error loading training evaluations:', e)
        setError(e?.message || 'Failed to load training evaluations')
        setItems([])
        setAnalytics(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (!FEATURE_ENABLED) {
    return (
      <AdminLayout>
        <div className="p-6"><p className="text-gray-600">Training evaluations are disabled.</p></div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Training Evaluations</h1>
          <p className="text-sm md:text-base text-gray-600">Monitor and analyze training feedback from volunteers and residents</p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="text-red-500">⚠️</div>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Error Loading Evaluations</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Analytics Dashboard */}
            {analytics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                {/* Total Evaluations */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Evaluations</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.totalEvaluations}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <MessageSquare className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </Card>

                {/* Average Rating */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Average Rating</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.averageRating.toFixed(1)}</p>
                      <div className="mt-2">
                        <StarRating rating={Math.round(analytics.averageRating)} readonly size="sm" showLabel={false} />
                      </div>
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <Star className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </Card>

                {/* Trend */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">7-Day Trend</p>
                      <p className={`text-3xl font-bold mt-2 ${
                        analytics.recentTrend === 'up' ? 'text-green-600' :
                        analytics.recentTrend === 'down' ? 'text-red-600' :
                        'text-gray-900'
                      }`}>
                        {analytics.recentTrend === 'up' ? '↑' : analytics.recentTrend === 'down' ? '↓' : '→'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {analytics.recentTrend === 'up' ? 'Improving' : 
                         analytics.recentTrend === 'down' ? 'Declining' : 'Stable'}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      analytics.recentTrend === 'up' ? 'bg-green-100' :
                      analytics.recentTrend === 'down' ? 'bg-red-100' :
                      'bg-gray-100'
                    }`}>
                      <TrendingUp className={`h-6 w-6 ${
                        analytics.recentTrend === 'up' ? 'text-green-600' :
                        analytics.recentTrend === 'down' ? 'text-red-600' :
                        'text-gray-600'
                      }`} />
                    </div>
                  </div>
                </Card>

                {/* Rating Distribution Chart */}
                <Card className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-3">Rating Distribution</p>
                  <div className="space-y-2">
                    {analytics.ratingDistribution.slice().reverse().map(({ rating, count }) => {
                      const percentage = analytics.totalEvaluations > 0 
                        ? (count / analytics.totalEvaluations) * 100 
                        : 0
                      return (
                        <div key={rating} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600 w-8">{rating}★</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-yellow-400 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* Evaluations Table */}
            <Card className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">All Evaluations</h2>
              
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {items.map((e) => (
                  <div key={e.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <UsersIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {e.user ? `${e.user.first_name} ${e.user.last_name}` : 'User'}
                          </div>
                          {e.user?.email && (
                            <div className="text-xs text-gray-500 truncate max-w-[180px]">{e.user.email}</div>
                          )}
                        </div>
                      </div>
                      <StarRating rating={e.rating} readonly size="sm" showLabel={false} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">Training</div>
                      <div className="text-sm font-medium text-gray-900">
                        {e.training?.title || `Training #${e.training_id.substring(0, 8)}`}
                      </div>
                    </div>
                    {e.comments && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">Comments</div>
                        <p className="text-sm text-gray-700">{e.comments}</p>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                      {new Date(e.created_at).toLocaleDateString()} at {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-8 text-center text-gray-500">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p>No evaluations yet</p>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">Training</th>
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">User</th>
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">Rating</th>
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">Comments</th>
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-900">
                            {e.training?.title || `Training #${e.training_id.substring(0, 8)}`}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <UsersIcon className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {e.user ? `${e.user.first_name} ${e.user.last_name}` : 'User'}
                              </div>
                              {e.user?.email && (
                                <div className="text-xs text-gray-500">{e.user.email}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StarRating rating={e.rating} readonly size="sm" showLabel={false} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="max-w-md">
                            {e.comments ? (
                              <p className="text-sm text-gray-700 line-clamp-2" title={e.comments}>
                                {e.comments}
                              </p>
                            ) : (
                              <span className="text-sm text-gray-400 italic">No comments</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-600">
                            {new Date(e.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-gray-500" colSpan={5}>
                          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p>No evaluations yet</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  )
}





