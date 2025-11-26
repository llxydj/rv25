"use client"

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type VolunteerLocationRow = {
  id: string
  user_id: string
  lat: number
  lng: number
  accuracy?: number | null
  speed?: number | null
  heading?: number | null
  created_at: string
}

export function useVolunteerLocationsChannel(onInsert: (row: VolunteerLocationRow) => void) {
  useEffect(() => {
    const channel = supabase
      .channel('realtime:public:volunteer_locations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'volunteer_locations' },
        (payload: any) => {
          const row = payload?.new as VolunteerLocationRow
          if (row) onInsert(row)
        }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [onInsert])
}
