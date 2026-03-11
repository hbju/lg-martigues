import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Notification } from '../types/supabase'

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  subscribe: (playerId: string) => () => void
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: (playerId: string) => Promise<void>
  fetchNotifications: (playerId: string) => Promise<void>
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: true,

  fetchNotifications: async (playerId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(50)
      .overrideTypes<Notification[]>()

    if (data) {
      set({
        notifications: data,
        unreadCount: data.filter(n => !n.read).length,
        isLoading: false,
      })
    } else {
      set({ isLoading: false })
    }
  },

  subscribe: (playerId: string) => {
    get().fetchNotifications(playerId)

    const channel = supabase
      .channel(`notifications_${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          set(state => ({
            notifications: [newNotif, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }))

          // Vibrate if supported
          if (navigator.vibrate) {
            navigator.vibrate(200)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  markAsRead: async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllAsRead: async (playerId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('player_id', playerId)
      .eq('read', false)

    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },
}))
