import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { PowerUp } from '../types/supabase'

interface PowerUpStore {
  powerUps: PowerUp[]
  isLoading: boolean
  fetchPowerUps: (playerId: string) => Promise<void>
  subscribe: (playerId: string) => () => void
  usePowerUp: (powerUpId: string, targetId: string) => Promise<{ success: boolean; error?: string }>
}

export const usePowerUpStore = create<PowerUpStore>((set, get) => ({
  powerUps: [],
  isLoading: true,

  fetchPowerUps: async (playerId: string) => {
    const { data } = await supabase
      .from('power_ups')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })

    if (data) {
      set({ powerUps: data as PowerUp[], isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },

  subscribe: (playerId: string) => {
    get().fetchPowerUps(playerId)

    const channel = supabase
      .channel(`power_ups_${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'power_ups',
          filter: `player_id=eq.${playerId}`,
        },
        () => {
          get().fetchPowerUps(playerId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  usePowerUp: async (powerUpId: string, targetId: string) => {
    const { error } = await supabase
      .from('power_ups')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_on: targetId,
      })
      .eq('id', powerUpId)

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  },
}))
