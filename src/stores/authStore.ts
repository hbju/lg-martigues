import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Player } from '../types/supabase'

interface AuthState {
    player: Player | null
    isGM: boolean
    isLoading: boolean
    login: (token: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    refreshPlayer: () => Promise<void>
    restoreSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
    player: null,
    isGM: false,
    isLoading: true,

    login: async (token: string) => {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('auth_token', token)
            .single<Player>()

        console.log('Login attempt with token:', token, 'Result:', { data, error })

        if (error || !data) {
            return { success: false, error: 'QR code invalide. Demande un nouveau code à ton MJ.' }
        }

        localStorage.setItem('lg_player_id', data.id)
        localStorage.setItem('lg_auth_token', token)
        set({ player: data, isGM: data.is_gm, isLoading: false })
        return { success: true }
    },

    logout: () => {
        localStorage.removeItem('lg_player_id')
        localStorage.removeItem('lg_auth_token')
        set({ player: null, isGM: false, isLoading: false })
    },

    refreshPlayer: async () => {
        const playerId = localStorage.getItem('lg_player_id')
        if (!playerId) return

        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('id', playerId)
            .single<Player>()

        if (data) {
            set({ player: data, isGM: data.is_gm })
        }
    },

    restoreSession: async () => {
        const playerId = localStorage.getItem('lg_player_id')
        const token = localStorage.getItem('lg_auth_token')

        if (!playerId || !token) {
            set({ isLoading: false })
            return
        }

        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('id', playerId)
            .eq('auth_token', token)
            .single<Player>()

        if (data) {
            set({ player: data, isGM: data.is_gm, isLoading: false })
        } else {
            localStorage.removeItem('lg_player_id')
            localStorage.removeItem('lg_auth_token')
            set({ isLoading: false })
        }
    },
}))
