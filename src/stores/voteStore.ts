import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { VoteRound, Vote, Player } from '../types/supabase'

interface VoteStore {
    currentRound: VoteRound | null
    votes: Vote[]
    isLoading: boolean
    fetchCurrentRound: () => Promise<void>
    subscribeToRounds: () => () => void
    subscribeToVotes: (roundId: string) => () => void
    castVote: (roundId: string, voterId: string, targetId: string) => Promise<{ success: boolean; error?: string }>
}

export const useVoteStore = create<VoteStore>((set, get) => ({
    currentRound: null,
    votes: [],
    isLoading: true,

    fetchCurrentRound: async () => {
        const { data } = await supabase
            .from('vote_rounds')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1)
            .overrideTypes<VoteRound[]>()

        set({ currentRound: data?.[0] ?? null, isLoading: false })
    },

    subscribeToRounds: () => {
        // Fetch initial
        get().fetchCurrentRound()

        const channel = supabase
            .channel('vote_rounds_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'vote_rounds' },
                () => {
                    get().fetchCurrentRound()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    subscribeToVotes: (roundId: string) => {
        // Fetch existing votes for this round
        const fetchVotes = async () => {
            const { data } = await supabase
                .from('votes')
                .select('*')
                .eq('round_id', roundId)
                .overrideTypes<Vote[]>()

            if (data) set({ votes: data })
        }

        fetchVotes()

        const channel = supabase
            .channel(`votes_${roundId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'votes', filter: `round_id=eq.${roundId}` },
                () => {
                    fetchVotes()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    castVote: async (roundId, voterId, targetId) => {
        const { error } = await supabase
            .from('votes')
            .insert({ round_id: roundId, voter_id: voterId, target_id: targetId })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    },
}))

// Helper hook for vote progress
export function getVoteProgress(votes: Vote[], alivePlayers: Player[], currentPlayerId: string | undefined) {
    return {
        totalVoters: alivePlayers.length,
        votedCount: votes.length,
        hasCurrentPlayerVoted: votes.some(v => v.voter_id === currentPlayerId),
    }
}
