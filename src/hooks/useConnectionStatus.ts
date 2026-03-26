import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

type ConnectionState = 'online' | 'reconnecting' | 'offline'

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState>(navigator.onLine ? 'online' : 'offline')
  const [lastOnline, setLastOnline] = useState<Date>(new Date())
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goOnline = useCallback(() => {
    setStatus('online')
    setLastOnline(new Date())
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }, [])

  const goOffline = useCallback(() => {
    setStatus('offline')
  }, [])

  useEffect(() => {
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    // Monitor Supabase realtime connection
    const channel = supabase.channel('connection_monitor')

    channel.on('system', { event: '*' }, (payload) => {
      if (payload.extension === 'postgres_changes') {
        // Connection healthy
        if (status !== 'online') goOnline()
      }
    })

    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        goOnline()
      } else if (s === 'CLOSED' || s === 'CHANNEL_ERROR') {
        if (navigator.onLine) {
          setStatus('reconnecting')
        } else {
          setStatus('offline')
        }
      }
    })

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      supabase.removeChannel(channel)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [])

  return { status, lastOnline }
}
