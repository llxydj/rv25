"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Calendar, MapPin, Users, AlertCircle, CheckCircle, User, Clock, Filter, Share2 as Facebook, Link as ExternalLink, LogIn as LogInIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { AnnouncementRating } from "@/components/announcement-rating"
import { LocationLinkDisplay } from "@/components/ui/location-link-display"

interface Announcement {
  id: string
  title: string
  content: string
  type: 'TRAINING' | 'MEETING' | 'ALERT' | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  location?: string
  location_lat?: number | null
  location_lng?: number | null
  date?: string
  time?: string
  requirements?: string[]
  created_at: string
  created_by: string | null
  creator?: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  facebook_post_url?: string | null
  facebook_embed_data?: any | null
  source_type?: 'MANUAL' | 'FACEBOOK' | null
}

const TYPE_CONFIG = {
  TRAINING: { 
    label: "Training", 
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    icon: Users,
    bgGradient: "from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10"
  },
  MEETING: { 
    label: "Meeting", 
    color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
    icon: Calendar,
    bgGradient: "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10"
  },
  ALERT: { 
    label: "Alert", 
    color: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
    icon: AlertCircle,
    bgGradient: "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10"
  },
  GENERAL: { 
    label: "General", 
    color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600",
    icon: CheckCircle,
    bgGradient: "from-gray-50 to-gray-100/50 dark:from-gray-800/20 dark:to-gray-700/10"
  }
}

const PRIORITY_CONFIG = {
  LOW: { 
    label: "Low", 
    color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600",
    dotColor: "bg-gray-400 dark:bg-gray-500"
  },
  MEDIUM: { 
    label: "Medium", 
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    dotColor: "bg-yellow-500 dark:bg-yellow-400"
  },
  HIGH: { 
    label: "High", 
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    dotColor: "bg-orange-500 dark:bg-orange-400"
  },
  CRITICAL: { 
    label: "Critical", 
    color: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
    dotColor: "bg-red-500 dark:bg-red-400",
    pulse: true
  }
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [filter, setFilter] = useState<'ALL' | 'TRAINING' | 'MEETING' | 'ALERT' | 'GENERAL'>('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/announcements', { cache: 'no-store' })
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setAnnouncements(json.data)
        } else {
          setAnnouncements([])
        }
      } catch (e) {
        console.error('Failed to fetch announcements:', e)
        setAnnouncements([])
      } finally {
        setLoading(false)
      }
    }
    fetchAnnouncements()
  }, [])

  const filteredAnnouncements = filter === 'ALL' 
    ? announcements 
    : announcements.filter(ann => ann.type === filter)

  const sortedAnnouncements = filteredAnnouncements.sort((a, b) => {
    // Sort by priority first, then by date
    const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Parse Facebook XFBML when announcements change or component mounts
  useEffect(() => {
    if (loading) return

    // Check if there are Facebook posts
    const hasFacebookPosts = sortedAnnouncements.some(ann => ann.source_type === 'FACEBOOK')
    if (!hasFacebookPosts) return

    const parseFacebookPosts = () => {
      // Wait for Facebook SDK to load and initialize
      if (typeof window !== 'undefined' && (window as any).FB && (window as any).FB.XFBML) {
        try {
          // Check if fb-post elements exist in DOM
          const fbPosts = document.querySelectorAll('.fb-post')
          if (fbPosts.length > 0) {
            // Parse the entire document to render all Facebook posts
            (window as any).FB.XFBML.parse()
            console.log(`Facebook posts parsed successfully (${fbPosts.length} posts found)`)
          } else {
            console.log('No fb-post elements found in DOM yet')
          }
        } catch (error) {
          console.error('Error parsing Facebook posts:', error)
        }
      } else {
        // Retry after a short delay if SDK not loaded yet
        let attempts = 0
        const maxAttempts = 50 // 5 seconds max
        const checkInterval = setInterval(() => {
          attempts++
          if (typeof window !== 'undefined' && (window as any).FB && (window as any).FB.XFBML) {
            try {
              const fbPosts = document.querySelectorAll('.fb-post')
              if (fbPosts.length > 0) {
                (window as any).FB.XFBML.parse()
                console.log(`Facebook posts parsed successfully (retry, ${fbPosts.length} posts found)`)
              }
            } catch (error) {
              console.error('Error parsing Facebook posts:', error)
            }
            clearInterval(checkInterval)
          } else if (attempts >= maxAttempts) {
            console.warn('Facebook SDK not loaded after max attempts')
            clearInterval(checkInterval)
          }
        }, 100)
      }
    }

    // Wait for DOM to be fully updated, then parse
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(parseFacebookPosts, 500)
    })
  }, [loading, sortedAnnouncements])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" text="Loading announcements..." />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Announcements
              </h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                Stay updated with the latest news, training schedules, and important alerts.
              </p>
            </div>
            {/* Login Button - Only show if user is not logged in */}
            {!authLoading && !user && (
              <div className="flex-shrink-0">
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 px-6 py-3 rounded-lg font-semibold"
                >
                  <LogInIcon className="h-5 w-5" />
                  <span className="hidden sm:inline">Login to Access</span>
                  <span className="sm:hidden">Login</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by type:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'ALL' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('ALL')}
              className="text-xs md:text-sm transition-all duration-200"
            >
              All
              {filter === 'ALL' && <span className="ml-2 text-xs">({announcements.length})</span>}
            </Button>
            {Object.entries(TYPE_CONFIG).map(([type, config]) => {
              const count = announcements.filter(a => a.type === type).length
              return (
                <Button
                  key={type}
                  variant={filter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(type as any)}
                  className="flex items-center gap-1.5 text-xs md:text-sm transition-all duration-200"
                >
                  <config.icon className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{config.label}</span>
                  <span className="sm:hidden">{config.label.slice(0, 3)}</span>
                  {filter === type && <span className="ml-1 text-xs">({count})</span>}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-4 md:space-y-6">
          {sortedAnnouncements.map((announcement) => {
            const typeConfig = TYPE_CONFIG[announcement.type]
            const priorityConfig = PRIORITY_CONFIG[announcement.priority]
            const TypeIcon = typeConfig.icon
            const isCritical = announcement.priority === 'CRITICAL'
            const creatorName = announcement.creator 
              ? `${announcement.creator.first_name} ${announcement.creator.last_name}`
              : 'Admin'

            return (
              <Card 
                key={announcement.id} 
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg border-2 transition-all duration-200 ${
                  isCritical 
                    ? 'border-red-300 dark:border-red-700 shadow-red-100/50 dark:shadow-red-900/20' 
                    : 'border-gray-200 dark:border-gray-700'
                } ${(priorityConfig as any).pulse && isCritical ? 'animate-pulse' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${typeConfig.color}`}>
                          <TypeIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          {typeConfig.label}
                        </Badge>
                        <Badge className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${priorityConfig.color}`}>
                          <span className={`h-2 w-2 rounded-full ${priorityConfig.dotColor} ${(priorityConfig as any).pulse ? 'animate-pulse' : ''}`}></span>
                          {priorityConfig.label} Priority
                        </Badge>
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                        {announcement.title}
                      </h2>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Facebook Post Indicator */}
                  {announcement.source_type === 'FACEBOOK' && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <Facebook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-300">Facebook Post</span>
                      {announcement.facebook_post_url && (
                        <a
                          href={announcement.facebook_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View on Facebook <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Facebook Embed */}
                  {announcement.source_type === 'FACEBOOK' && announcement.facebook_post_url ? (
                    <div className="space-y-2">
                      <div className="facebook-embed-container my-4" key={`fb-${announcement.id}`}>
                        <div
                          className="fb-post"
                          data-href={announcement.facebook_post_url}
                          data-width="500"
                          data-show-text="true"
                          data-lazy="false"
                        />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                        💡 If the post doesn't appear, ensure it's public and use the direct post URL (not a share link).
                      </div>
                    </div>
                  ) : (
                    /* Regular Content */
                    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                      {announcement.content}
                    </p>
                  )}

                  {/* Details Grid */}
                  {(announcement.location || announcement.date) && (
                    <div className="space-y-4">
                      {announcement.date && (
                        <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <Calendar className="h-5 w-5 flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400" />
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400 block mb-1">Date & Time</span>
                            <span>{announcement.date} {announcement.time && `• ${announcement.time}`}</span>
                          </div>
                        </div>
                      )}
                      {announcement.location && (
                        <LocationLinkDisplay
                          location={announcement.location}
                          className="w-full"
                        />
                      )}
                    </div>
                  )}

                  {/* Requirements */}
                  {announcement.requirements && announcement.requirements.length > 0 && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Requirements:
                      </h4>
                      <ul className="space-y-2">
                        {announcement.requirements.map((req, index) => (
                          <li 
                            key={index} 
                            className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                          >
                            <span className="text-blue-600 dark:text-blue-400 mt-1.5 font-bold">•</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Creator and Timestamp */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700">
                        <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Posted by {creatorName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(announcement.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Rating Component */}
                  <AnnouncementRating announcementId={announcement.id} />
                </CardContent>
              </Card>
            )
          })}
        </div>

        {sortedAnnouncements.length === 0 && (
          <div className="space-y-4">
            <Card className="bg-white dark:bg-gray-800">
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 md:h-16 md:w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No announcements found
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                  {filter === 'ALL' 
                    ? "There are no announcements available at this time."
                    : `There are no ${TYPE_CONFIG[filter].label.toLowerCase()} announcements matching your filter.`
                  }
                </p>
              </CardContent>
            </Card>
            
            {/* Login Prompt Card - Only show if user is not logged in */}
            {!authLoading && !user && (
              <Card className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-800">
                <CardContent className="text-center py-8 px-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                    <LogIn className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Want to access more features?
                  </h3>
                  <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 mb-6">
                    Login to report incidents, view your history, and access exclusive content.
                  </p>
                  <Button
                    onClick={() => router.push('/login')}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 px-8 py-3 rounded-lg font-semibold mx-auto"
                  >
                    <LogInIcon className="h-5 w-5" />
                    Login Now
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Floating Login Button (Mobile) - Only show if user is not logged in */}
      {!authLoading && !user && (
        <div className="fixed bottom-6 right-6 z-50 sm:hidden">
          <Button
            onClick={() => router.push('/login')}
            className="h-14 w-14 rounded-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-2xl hover:shadow-3xl transition-all duration-200 flex items-center justify-center p-0"
            aria-label="Login"
          >
            <LogIn className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}
