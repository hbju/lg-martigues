import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Player } from '../types/supabase'

export function useRealtimePlayers() {
    const [players, setPlayers] = useState<Player[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchPlayers = async () => {
            const { data } = await supabase
                .from('players')
                .select('*')
                .eq('is_gm', false)
                .order('name')
                .overrideTypes<Player[]>()

            if (data) setPlayers(data)
            setIsLoading(false)
        }

        fetchPlayers()

        const channel = supabase
            .channel('players_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'players' },
                () => {
                    fetchPlayers()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return { players, isLoading }
}
