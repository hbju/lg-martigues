import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../stores/gameStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'

export function GMInfectionPage() {
    const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
    const { players } = useRealtimePlayers()
    const [isConfirming, setIsConfirming] = useState(false)
    const [isRejecting, setIsRejecting] = useState(false)

    useEffect(() => {
        fetchGameState()
        const unsub = subscribeToGameState()
        return unsub
    }, [])

    if (!gameState) return null

    const metadata = (gameState.metadata ?? {}) as Record<string, unknown>
    const infectionPending = metadata.infection_pending === true
    const infectorId = metadata.infector_id as string | undefined
    const infectionTargetId = metadata.infection_target as string | undefined

    const infector = players.find(p => p.id === infectorId)
    const target = players.find(p => p.id === infectionTargetId)

    if (!infectionPending) {
        return (
            <div className="min-h-screen bg-village-night p-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-6">
                        🦠 Infection
                    </h1>
                    <div className="bg-parchment-card rounded-xl p-6 backdrop-blur-sm text-center">
                        <p className="font-crimson text-moon-400 italic">
                            Aucune infection en attente. L'infection se déclenche quand il ne reste qu'un seul loup.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    async function handleConfirmInfection() {
        if (!infectionTargetId || !infectorId || !gameState) return
        setIsConfirming(true)

        // Update target player role
        await supabase
            .from('players')
            .update({ role: 'werewolf' })
            .eq('id', infectionTargetId)

        // Update game state
        await supabase
            .from('game_state')
            .update({
                werewolf_count: gameState.werewolf_count + 1,
                villager_count: Math.max(0, gameState.villager_count - 1),
                metadata: {
                    ...(gameState.metadata ?? {}),
                    infection_pending: false,
                    infection_target: null,
                    infector_id: null,
                    werewolf_discovery_confirmed: true,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', 1)

        // Notify new werewolf
        await supabase.from('notifications').insert({
            player_id: infectionTargetId,
            type: 'infected' as const,
            title: 'Corrompu !',
            message: `Tu as été corrompu. Tu es désormais un Loup-Garou. Ton allié est ${infector?.name ?? 'inconnu'}.`,
        })

        // Notify original werewolf
        await supabase.from('notifications').insert({
            player_id: infectorId,
            type: 'infected' as const,
            title: 'Nouveau membre',
            message: `${target?.name ?? 'Un joueur'} a rejoint ta meute.`,
        })

        setIsConfirming(false)
    }

    async function handleRejectInfection() {
        if (!gameState) return
        setIsRejecting(true)

        // Clear infection target, let wolf pick again
        await supabase
            .from('game_state')
            .update({
                metadata: {
                    ...(gameState.metadata ?? {}),
                    infection_target: null,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', 1)

        setIsRejecting(false)
    }

    return (
        <div className="min-h-screen bg-village-night p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-6">
                    🦠 Infection
                </h1>

                <div className="bg-blood-800/20 border border-blood-500/30 rounded-xl p-5 mb-6">
                    <p className="font-crimson text-red-300 mb-2">
                        <span className="font-semibold">{infector?.name ?? '?'}</span> (dernier loup) veut infecter :
                    </p>

                    {infectionTargetId && target ? (
                        <>
                            <div className="bg-blood-800/40 rounded-lg p-4 mb-6 text-center">
                                <p className="font-cinzel text-red-400 text-xl font-bold">{target.name}</p>
                                <p className="font-crimson text-moon-400 text-sm mt-1">sera transformé en Loup-Garou</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleRejectInfection}
                                    disabled={isRejecting || isConfirming}
                                    className="flex-1 bg-night-700 hover:bg-night-600 text-parchment-200 font-crimson py-3 rounded-lg transition-colors border border-night-600"
                                >
                                    {isRejecting ? '...' : '✕ Refuser (choisir à nouveau)'}
                                </button>
                                <button
                                    onClick={handleConfirmInfection}
                                    disabled={isConfirming || isRejecting}
                                    className="flex-1 bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                                >
                                    {isConfirming ? '...' : '🦠 Confirmer l\'infection'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="font-crimson text-moon-400 italic text-center py-4">
                            En attente du choix du loup...
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
