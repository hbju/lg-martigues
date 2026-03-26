import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { VoteRound, Vote, Player } from '../types/supabase'

interface QueuedVote {
    roundId: string
    voterId: string
    targetId: string
    timestamp: number
}

interface VoteStore {
    currentRound: VoteRound | null
    votes: Vote[]
    isLoading: boolean
    queuedVote: QueuedVote | null
    fetchCurrentRound: () => Promise<void>
    subscribeToRounds: () => () => void
    subscribeToVotes: (roundId: string) => () => void
    castVote: (roundId: string, voterId: string, targetId: string) => Promise<{ success: boolean; error?: string }>
    flushQueuedVotes: () => Promise<void>
}

export const useVoteStore = create<VoteStore>((set, get) => ({
    currentRound: null,
    votes: [],
    isLoading: true,
    queuedVote: null,

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
        // Flush any queued votes from offline
        get().flushQueuedVotes()

        const handleOnline = () => { get().flushQueuedVotes() }
        window.addEventListener('online', handleOnline)

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
            window.removeEventListener('online', handleOnline)
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
        // If offline, queue the vote
        if (!navigator.onLine) {
            const queued: QueuedVote = { roundId, voterId, targetId, timestamp: Date.now() }
            set({ queuedVote: queued })
            localStorage.setItem('lg_queued_vote', JSON.stringify(queued))
            return { success: true }
        }

        const { error } = await supabase
            .from('votes')
            .insert({ round_id: roundId, voter_id: voterId, target_id: targetId })

        if (error) {
            if (error.message.includes('unique') || error.message.includes('duplicate')) {
                return { success: false, error: 'Tu as déjà voté ce tour.' }
            }
            return { success: false, error: error.message }
        }
        return { success: true }
    },

    flushQueuedVotes: async () => {
        const stored = localStorage.getItem('lg_queued_vote')
        if (!stored) return

        const queued: QueuedVote = JSON.parse(stored)

        // Check if the round is still open
        const { data: round } = await supabase
            .from('vote_rounds')
            .select('status')
            .eq('id', queued.roundId)
            .single()

        if (round?.status !== 'open') {
            // Round closed, discard
            localStorage.removeItem('lg_queued_vote')
            set({ queuedVote: null })
            return
        }

        const { error } = await supabase
            .from('votes')
            .insert({
                round_id: queued.roundId,
                voter_id: queued.voterId,
                target_id: queued.targetId,
            })

        localStorage.removeItem('lg_queued_vote')
        set({ queuedVote: null })

        if (error) {
            console.warn('Failed to flush queued vote:', error.message)
        }
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
