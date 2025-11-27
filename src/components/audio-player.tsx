"use client"

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

interface AudioPlayerProps {
  voiceUrl: string
  incidentId: string
}

export function AudioPlayer({ voiceUrl, incidentId }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Extract path from voice_url
  // voice_url format: "userId/timestamp.ext" or full path
  const getPathFromUrl = (url: string): string => {
    // If it's already a path (no http/https), return as is
    if (!url.startsWith('http')) {
      return url
    }
    
    // If it's a full URL, extract the path after the bucket name
    // Example: https://...supabase.co/storage/v1/object/sign/incident-voice/userId/timestamp.ext
    const match = url.match(/incident-voice\/(.+)$/)
    if (match) {
      return match[1]
    }
    
    // Fallback: try to extract last two path segments
    const parts = url.split('/')
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
    }
    
    return url
  }

  const getSignedUrl = async (): Promise<string | null> => {
    if (audioUrl) return audioUrl
    
    setLoading(true)
    setError(null)
    
    try {
      const path = getPathFromUrl(voiceUrl)
      
      const { data, error: signError } = await supabase
        .storage
        .from('incident-voice')
        .createSignedUrl(path, 3600) // 1 hour expiry
      
      if (signError) {
        console.error('Error getting signed URL:', signError)
        throw signError
      }
      
      if (data?.signedUrl) {
        setAudioUrl(data.signedUrl)
        return data.signedUrl
      }
      
      throw new Error('No signed URL returned')
    } catch (err: any) {
      console.error('Error getting signed URL:', err)
      setError(err.message || 'Failed to load audio')
      return null
    } finally {
      setLoading(false)
    }
  }

  const togglePlay = async () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      const url = await getSignedUrl()
      if (url && audioRef.current) {
        audioRef.current.src = url
        audioRef.current.play().catch((err) => {
          console.error('Error playing audio:', err)
          setError('Failed to play audio')
          setIsPlaying(false)
        })
        setIsPlaying(true)
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <Button
        type="button"
        onClick={togglePlay}
        disabled={loading || !!error}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      
      <div className="flex-1">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Voice Message
        </span>
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
      
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false)
          setError('Error playing audio file')
        }}
        onLoadedData={() => setError(null)}
        className="hidden"
      />
    </div>
  )
}

