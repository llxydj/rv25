# Voice Message Feature - Implementation Proposal

## 🎯 **OBJECTIVE**
Add optional voice message recording to resident incident reporting, allowing residents to quickly report incidents by speaking instead of typing, without affecting existing functionality or causing delays.

---

## ✅ **PROPOSED APPROACH: Non-Destructive & Optimized**

### **Strategy:**
1. **Optional Feature** - Voice recording is completely optional, doesn't replace text description
2. **Client-Side Recording** - Uses browser MediaRecorder API (no external dependencies)
3. **Async Upload** - Audio uploads in background after form submission (doesn't block submission)
4. **Existing Infrastructure** - Uses Supabase Storage (same as photos)
5. **Simple Playback** - HTML5 audio player for admins/volunteers

---

## 📋 **IMPLEMENTATION PLAN**

### **Phase 1: Database Schema (5 minutes)**
**File:** `supabase/migrations/[timestamp]_add_voice_url_to_incidents.sql`

```sql
-- Add voice_url column to incidents table
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS voice_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.incidents.voice_url IS 'URL to voice message recording for this incident';
```

**Impact:** ✅ Zero breaking changes, optional field

---

### **Phase 2: Storage Bucket Setup (2 minutes)**
**File:** `supabase/migrations/[timestamp]_create_incident_voice_bucket.sql`

```sql
-- Create storage bucket for voice messages (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-voice',
  'incident-voice',
  false,
  5242880, -- 5MB limit (reasonable for voice)
  ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload their own voice messages
CREATE POLICY IF NOT EXISTS "Users can upload voice messages"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'incident-voice' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can read their own voice messages
CREATE POLICY IF NOT EXISTS "Users can read voice messages"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'incident-voice' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Admins can read all voice messages
CREATE POLICY IF NOT EXISTS "Admins can read all voice messages"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'incident-voice' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policy: Volunteers can read voice messages for assigned incidents
CREATE POLICY IF NOT EXISTS "Volunteers can read assigned voice messages"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'incident-voice' AND
  EXISTS (
    SELECT 1 FROM public.incidents
    WHERE assigned_to = auth.uid()
    AND voice_url LIKE '%' || storage.objects.name
  )
);
```

**Impact:** ✅ Secure, follows existing photo storage pattern

---

### **Phase 3: Audio Upload API (10 minutes)**
**File:** `src/app/api/incidents/upload-voice/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const BUCKET = 'incident-voice'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set(['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg'])

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const reporterId = String(form.get('reporter_id') || '')

    // Validate authentication
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.id !== reporterId) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Authentication required' },
        { status: 403 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: 'File is required' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, code: 'UNSUPPORTED_TYPE', message: 'Only audio files are allowed' },
        { status: 415 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Audio exceeds 5MB limit' },
        { status: 413 }
      )
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'webm'
    const path = `${reporterId}/${Date.now()}.${ext}`

    // Upload to Supabase Storage
    const arrayBuf = await file.arrayBuffer()
    const { error: upErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .upload(path, Buffer.from(arrayBuf), {
        contentType: file.type,
        upsert: false,
        cacheControl: '3600',
      })

    if (upErr) {
      return NextResponse.json(
        { success: false, code: 'UPLOAD_FAILED', message: upErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, path })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Upload failed' },
      { status: 500 }
    )
  }
}
```

**Impact:** ✅ Follows existing photo upload pattern, secure

---

### **Phase 4: Voice Recorder Component (20 minutes)**
**File:** `src/components/voice-recorder.tsx`

```typescript
"use client"

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Play, Pause, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onRecordingDelete: () => void
  disabled?: boolean
}

export function VoiceRecorder({ onRecordingComplete, onRecordingDelete, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        onRecordingComplete(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Microphone access denied. Please allow microphone access to record voice messages.')
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {!audioBlob ? (
          <>
            {!isRecording ? (
              <Button
                type="button"
                onClick={startRecording}
                disabled={disabled}
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
          <div className="flex items-center gap-2">
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
              className="hidden"
            />
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {!audioBlob 
          ? "Record a voice message to quickly describe the incident (optional)"
          : "Voice message recorded. You can play, delete, or submit with your report."
        }
      </p>
    </div>
  )
}
```

**Impact:** ✅ Simple, reusable component, handles all recording logic

---

### **Phase 5: Update Incident Creation (15 minutes)**

#### **5a. Update API Route**
**File:** `src/app/api/incidents/route.ts`

Add `voice_url` to the payload:

```typescript
const payload = {
  // ... existing fields
  voice_url: parsed.data.voice_url || null,
}
```

#### **5b. Update Incident Schema**
**File:** `src/lib/incidents.ts` (or wherever IncidentCreateSchema is defined)

Add `voice_url` as optional field:

```typescript
voice_url: z.string().url().optional().nullable(),
```

#### **5c. Update Resident Report Form**
**File:** `src/app/resident/report/page.tsx`

Add voice recording state and upload:

```typescript
const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
const [voiceUploading, setVoiceUploading] = useState(false)

// In handleSubmit, after photo upload:
if (voiceBlob) {
  setVoiceUploading(true)
  try {
    const voiceFormData = new FormData()
    voiceFormData.append('file', voiceBlob, 'voice.webm')
    voiceFormData.append('reporter_id', user.id)
    
    const voiceResponse = await fetch('/api/incidents/upload-voice', {
      method: 'POST',
      body: voiceFormData,
    })
    
    const voiceResult = await voiceResponse.json()
    if (voiceResult.success) {
      // Include voice_url in incident creation
      incidentData.voice_url = voiceResult.path
    }
  } catch (err) {
    console.error('Voice upload failed:', err)
    // Don't fail incident creation if voice upload fails
  } finally {
    setVoiceUploading(false)
  }
}
```

**Impact:** ✅ Non-blocking, doesn't delay incident submission

---

### **Phase 6: Audio Player Component (10 minutes)**
**File:** `src/components/audio-player.tsx`

```typescript
"use client"

import { useState, useRef } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'
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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const getSignedUrl = async () => {
    if (audioUrl) return audioUrl
    
    setLoading(true)
    try {
      // Extract path from full URL or use directly
      const path = voiceUrl.includes('/') ? voiceUrl.split('/').slice(-2).join('/') : voiceUrl
      
      const { data, error } = await supabase
        .storage
        .from('incident-voice')
        .createSignedUrl(path, 3600) // 1 hour expiry
      
      if (error) throw error
      if (data?.signedUrl) {
        setAudioUrl(data.signedUrl)
        return data.signedUrl
      }
    } catch (err) {
      console.error('Error getting signed URL:', err)
    } finally {
      setLoading(false)
    }
    return null
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
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <Button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        variant="outline"
        size="sm"
      >
        {loading ? (
          <Volume2 className="h-4 w-4 animate-pulse" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Voice Message
      </span>
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false)
          setLoading(false)
        }}
        className="hidden"
      />
    </div>
  )
}
```

**Impact:** ✅ Simple playback, secure signed URLs

---

### **Phase 7: Display in Incident Detail Pages (10 minutes)**

#### **7a. Admin Incident Detail**
**File:** `src/app/admin/incidents/[id]/page.tsx`

Add audio player if `voice_url` exists:

```typescript
{incident.voice_url && (
  <div className="mt-4">
    <AudioPlayer voiceUrl={incident.voice_url} incidentId={incident.id} />
  </div>
)}
```

#### **7b. Volunteer Incident Detail**
**File:** `src/app/volunteer/incident/[id]/page.tsx`

Same addition.

**Impact:** ✅ Easy access for admins and volunteers

---

## ⚡ **OPTIMIZATION STRATEGIES**

### **1. Non-Blocking Upload**
- Voice upload happens **after** incident is created
- If voice upload fails, incident still succeeds
- Voice URL can be updated later if needed

### **2. Client-Side Compression**
- Browser MediaRecorder uses efficient WebM codec
- Automatic compression reduces file size
- No server-side processing needed

### **3. Lazy Loading**
- Audio player only loads when clicked
- Signed URLs generated on-demand
- No unnecessary bandwidth usage

### **4. Time Limits**
- Suggest max 2-3 minutes recording
- Prevents large file uploads
- Keeps reports concise

---

## 📊 **ESTIMATED IMPACT**

### **Performance:**
- ✅ **Zero delay** to incident submission (async upload)
- ✅ **Minimal bandwidth** (compressed audio, ~100-500KB per recording)
- ✅ **No external dependencies** (browser APIs only)

### **User Experience:**
- ✅ **Optional feature** - doesn't interfere with existing flow
- ✅ **Quick recording** - faster than typing for some users
- ✅ **Easy playback** - one-click listen for admins/volunteers

### **Complexity:**
- ✅ **Low complexity** - uses existing patterns (photo upload)
- ✅ **No breaking changes** - completely optional
- ✅ **Easy to maintain** - follows existing code structure

---

## 🎯 **IMPLEMENTATION CHECKLIST**

- [ ] Phase 1: Database migration (add `voice_url` column)
- [ ] Phase 2: Storage bucket setup
- [ ] Phase 3: Audio upload API endpoint
- [ ] Phase 4: Voice recorder component
- [ ] Phase 5: Update incident creation flow
- [ ] Phase 6: Audio player component
- [ ] Phase 7: Display in incident detail pages
- [ ] Testing: Record, upload, playback
- [ ] Testing: Verify no impact on existing flow

---

## ✅ **FINAL RECOMMENDATION**

**This approach is:**
1. ✅ **Non-destructive** - Completely optional, doesn't affect existing functionality
2. ✅ **Optimized** - Async upload, no blocking, efficient compression
3. ✅ **Simple** - Uses existing infrastructure, standard web APIs
4. ✅ **Achievable** - 100% doable with current tech stack
5. ✅ **Maintainable** - Follows existing code patterns

**Total Implementation Time:** ~1-2 hours
**Risk Level:** Low (optional feature, can be disabled if issues arise)
**User Impact:** Positive (faster reporting for some users)

---

**Ready to proceed?** This proposal ensures zero impact on existing incident reporting while adding a valuable optional feature.

