import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Player } from '../types/supabase'

interface AuthState {
    player: Player | null
    isGM: boolean
    isLoading: boolean
    login: (token: string) => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<void>
    refreshPlayer: () => Promise<void>
    restoreSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
    player: null,
    isGM: false,
    isLoading: true,

    login: async (token: string) => {
        try {
            // 1. Call RPC to provision auth user and get email
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('login_with_token', { p_token: token })

            if (rpcError || !rpcData) {
                return { success: false, error: 'QR code invalide. Demande un nouveau code à ton MJ.' }
            }

            const { email, player_id } = rpcData as { email: string; player_id: string; is_gm: boolean }

            // 2. Sign in with Supabase Auth
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: token,
            })

            if (signInError) {
                return { success: false, error: 'Erreur d\'authentification. Réessaie ou demande un nouveau code.' }
            }

            // 3. Fetch the full player record
            const { data: player, error: playerError } = await supabase
                .from('players')
                .select('*')
                .eq('id', player_id)
                .single<Player>()

            if (playerError || !player) {
                return { success: false, error: 'Joueur introuvable.' }
            }

            set({ player, isGM: player.is_gm, isLoading: false })
            return { success: true }
        } catch {
            return { success: false, error: 'Erreur de connexion. Vérifie ta connexion internet.' }
        }
    },

    logout: async () => {
        await supabase.auth.signOut()
        set({ player: null, isGM: false, isLoading: false })
    },

    refreshPlayer: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return

        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('id', session.user.id)
            .single<Player>()

        if (data) {
            set({ player: data, isGM: data.is_gm })
        }
    },

    restoreSession: async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user?.id) {
            set({ isLoading: false })
            return
        }

        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('id', session.user.id)
            .single<Player>()

        if (data) {
            set({ player: data, isGM: data.is_gm, isLoading: false })
        } else {
            // Session exists but no matching player — sign out
            await supabase.auth.signOut()
            set({ isLoading: false })
        }
    },
}))
