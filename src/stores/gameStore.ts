import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { GameState } from '../types/supabase'

interface GameStore {
    gameState: GameState | null
    isLoading: boolean
    fetchGameState: () => Promise<void>
    subscribeToGameState: () => () => void
}

export const useGameStore = create<GameStore>((set) => ({
    gameState: null,
    isLoading: true,

    fetchGameState: async () => {
        const { data } = await supabase
            .from('game_state')
            .select('*')
            .eq('id', 1)
            .single<GameState>()

        if (data) {
            set({ gameState: data, isLoading: false })
        } else {
            set({ isLoading: false })
        }
    },

    subscribeToGameState: () => {
        const channel = supabase
            .channel('game_state_changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_state' },
                (payload) => {
                    set({ gameState: payload.new as GameState })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },
}))
