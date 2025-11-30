"use client"

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Play, Pause, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onRecordingDelete: () => void
  disabled?: boolean
}

// Check if MediaRecorder is supported
const isMediaRecorderSupported = (): boolean => {
  return typeof MediaRecorder !== 'undefined'
}

// Check if getUserMedia is available
const isGetUserMediaSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 
         navigator.mediaDevices !== undefined && 
         typeof navigator.mediaDevices.getUserMedia === 'function'
}

// Get supported MIME type
const getSupportedMimeType = (): string | null => {
  if (!isMediaRecorderSupported()) return null
  
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ]
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  
  // Fallback to default webm
  return 'audio/webm'
}

export function VoiceRecorder({ onRecordingComplete, onRecordingDelete, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Check browser support on mount
  useEffect(() => {
    const mediaRecorderSupported = isMediaRecorderSupported()
    const getUserMediaSupported = isGetUserMediaSupported()
    const supported = mediaRecorderSupported && getUserMediaSupported
    setIsSupported(supported)
    
    if (!supported) {
      if (!getUserMediaSupported) {
        setError('Microphone access is not available. Please ensure you are using HTTPS and allow microphone permissions.')
      } else {
        setError('Voice recording is not supported on this device. Please use text description instead.')
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    if (!isMediaRecorderSupported()) {
      setError('Voice recording is not supported on this device.')
      return
    }

    if (!isGetUserMediaSupported()) {
      setError('Microphone access is not available. Please ensure you are using HTTPS and allow microphone permissions.')
      return
    }

    try {
      setError(null)
      const stream = await navigator.mediaDevices!.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = getSupportedMimeType()
      if (!mimeType) {
        throw new Error('No supported audio format found')
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        onRecordingComplete(blob)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event)
        setError('Recording error occurred. Please try again.')
        setIsRecording(false)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
      
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at 3 minutes (180 seconds)
          if (newTime >= 180) {
            stopRecording()
            return 180
          }
          return newTime
        })
      }, 1000)
    } catch (error: any) {
      console.error('Error starting recording:', error)
      setError(error.message || 'Microphone access denied. Please allow microphone access to record voice messages.')
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
      setAudioBlob(null)
      setRecordingTime(0)
      onRecordingDelete()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Show unsupported message
  if (isSupported === false) {
    return (
      <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-800 font-medium">Voice recording not available</p>
            <p className="text-xs text-yellow-700 mt-1">
              Voice recording is not supported on this device. Please use the text description field instead.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      
      <div className="flex items-center gap-3">
        {!audioBlob ? (
          <>
            {!isRecording ? (
              <Button
                type="button"
                onClick={startRecording}
                disabled={disabled || isSupported === false}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Mic className="h-4 w-4" />
                Start Recording
              </Button>
            ) : (
              <Button
                type="button"
                onClick={stopRecording}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Stop Recording ({formatTime(recordingTime)})
              </Button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              onClick={playRecording}
              variant="outline"
              size="sm"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <span className="text-sm text-gray-600">{formatTime(recordingTime)}</span>
            <Button
              type="button"
              onClick={deleteRecording}
              variant="ghost"
              size="sm"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
            <audio
              ref={audioRef}
              src={audioUrl || undefined}
              onEnded={() => setIsPlaying(false)}
              onError={() => {
                setIsPlaying(false)
                setError('Error playing audio')
              }}
              className="hidden"
            />
          </div>
        )}
      </div>
      
      <p className="text-xs text-gray-500">
        {!audioBlob 
          ? "Record a voice message to quickly describe the incident (optional, max 3 minutes)"
          : "Voice message recorded. You can play, delete, or submit with your report."
        }
      </p>
    </div>
  )
}

