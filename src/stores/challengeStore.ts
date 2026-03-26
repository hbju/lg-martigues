import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Challenge, ChallengeScore, Team, TeamMember } from '../types/supabase'

interface ChallengeStore {
    challenges: Challenge[]
    scores: ChallengeScore[]
    teams: Team[]
    teamMembers: TeamMember[]
    isLoading: boolean
    fetchChallenges: () => Promise<void>
    fetchScores: (challengeId: string) => Promise<void>
    fetchTeams: (challengeId?: string) => Promise<void>
    fetchTeamMembers: () => Promise<void>
    subscribeToChallenge: (challengeId: string) => () => void
    subscribeToAll: () => () => void
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
    challenges: [],
    scores: [],
    teams: [],
    teamMembers: [],
    isLoading: true,

    fetchChallenges: async () => {
        const { data } = await supabase
            .from('challenges')
            .select('*')
            .order('created_at', { ascending: false })

        if (data) {
            console.log("Fetched challenges:", data)
            set({ challenges: data as Challenge[], isLoading: false })
        } else {
            console.error("Failed to fetch challenges")
            set({ isLoading: false })
        }
    },

    fetchScores: async (challengeId: string) => {
        const { data } = await supabase
            .from('challenge_scores')
            .select('*')
            .eq('challenge_id', challengeId)
            .order('score', { ascending: false })

        if (data) {
            set({ scores: data as ChallengeScore[] })
        }
    },

    fetchTeams: async (challengeId?: string) => {
        let query = supabase.from('teams').select('*')
        if (challengeId) query = query.eq('challenge_id', challengeId)
        const { data } = await query.order('created_at')

        if (data) {
            set({ teams: data as Team[] })
        }
    },

    fetchTeamMembers: async () => {
        const { data } = await supabase.from('team_members').select('*')
        if (data) {
            set({ teamMembers: data as TeamMember[] })
        }
    },

    subscribeToChallenge: (challengeId: string) => {
        get().fetchScores(challengeId)
        get().fetchTeams(challengeId)
        get().fetchTeamMembers()

        const ch1 = supabase
            .channel(`challenge_scores_${challengeId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_scores', filter: `challenge_id=eq.${challengeId}` }, () => {
                get().fetchScores(challengeId)
            })
            .subscribe()

        const ch2 = supabase
            .channel(`teams_${challengeId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
                get().fetchTeams(challengeId)
            })
            .subscribe()

        const ch3 = supabase
            .channel(`team_members_${challengeId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
                get().fetchTeamMembers()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(ch1)
            supabase.removeChannel(ch2)
            supabase.removeChannel(ch3)
        }
    },

    subscribeToAll: () => {
        get().fetchChallenges()

        const channel = supabase
            .channel('challenges_all')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, () => {
                get().fetchChallenges()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },
}))
