"use client"
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'

export function useNotificationsChannel() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`public:notifications:user:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Optionally, we could toast or refetch notifications list in context
          // console.log('Notification change', payload)
        }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [user?.id])
}
