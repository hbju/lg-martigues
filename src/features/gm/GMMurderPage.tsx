import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useVoteStore, getVoteProgress } from '../../stores/voteStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { useGameStore } from '../../stores/gameStore'
import { CountdownTimer } from '../../components/ui/CountdownTimer'
import type { VoteRound, Vote, Elimination } from '../../types/supabase'

export function GMMurderPage() {
    const { player } = useAuthStore()
    const { gameState } = useGameStore()
    const { currentRound, votes, subscribeToRounds, subscribeToVotes } = useVoteStore()
    const { players } = useRealtimePlayers()
    const [timerMinutes, setTimerMinutes] = useState(30)
    const [isCreating, setIsCreating] = useState(false)
    const [isResolving, setIsResolving] = useState(false)
    const [pendingElimination, setPendingElimination] = useState<Elimination | null>(null)
    const [isConfirming, setIsConfirming] = useState(false)
    const [timerExpired, setTimerExpired] = useState(false)
    const [lastResult, setLastResult] = useState<{ method: string; targetName: string } | null>(null)

    useEffect(() => {
        const unsub = subscribeToRounds()
        return unsub
    }, [])

    useEffect(() => {
        if (!currentRound || currentRound.type !== 'murder') return
        const unsub = subscribeToVotes(currentRound.id)
        return unsub
    }, [currentRound?.id])

    useEffect(() => {
        fetchPendingMurder()
    }, [])

    async function fetchPendingMurder() {
        const { data: elim } = await supabase
            .from('eliminations')
            .select('*')
            .in('method', ['murdered', 'random'])
            .eq('confirmed_by_gm', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .overrideTypes<Elimination[]>()

        if (elim?.[0]) setPendingElimination(elim[0])
    }

    if (!player) return null

    const alivePlayers = players.filter(p => p.status === 'alive' && !p.is_gm)
    const aliveWerewolves = players.filter(p => p.role === 'werewolf' && p.status === 'alive' && !p.is_gm)
    const isMurderRound = currentRound?.type === 'murder' && currentRound?.status === 'open'
    const progress = isMurderRound ? getVoteProgress(votes, aliveWerewolves, player.id) : null

    async function handleOpenMurder() {
        if (!player) return
        setIsCreating(true)

        // Check for concurrent open rounds
        const { data: openRounds } = await supabase
            .from('vote_rounds')
            .select('id')
            .eq('status', 'open')

        if (openRounds && openRounds.length > 0) {
            alert('Un vote est déjà en cours. Ferme-le avant d\'en ouvrir un nouveau.')
            setIsCreating(false)
            return
        }

        const now = new Date()
        const endAt = new Date(now.getTime() + timerMinutes * 60 * 1000)

        const { data: round } = await supabase
            .from('vote_rounds')
            .insert({
                type: 'murder' as const,
                status: 'open' as const,
                timer_duration_seconds: timerMinutes * 60,
                timer_started_at: now.toISOString(),
                timer_end_at: endAt.toISOString(),
                created_by: player.id,
            })
            .select()
            .single<VoteRound>()

        // Notify werewolves
        if (round) {
            const notifs = aliveWerewolves.map(w => ({
                player_id: w.id,
                type: 'murder_window' as const,
                title: 'La Chasse commence',
                message: `La fenêtre de meurtre est ouverte. Tu as ${timerMinutes} minutes.`,
            }))
            await supabase.from('notifications').insert(notifs)
        }

        setTimerExpired(false)
        setIsCreating(false)
    }

    async function handleCloseMurder() {
        if (!currentRound) return
        setIsResolving(true)

        // 1. Fetch all murder votes
        const { data: allVotes } = await supabase
            .from('votes')
            .select('*')
            .eq('round_id', currentRound.id)
            .overrideTypes<Vote[]>()

        const existingVotes = allVotes ?? []

        // 2. Check unanimity
        const voterIds = new Set(existingVotes.map(v => v.voter_id))
        const allWolvesVoted = aliveWerewolves.every(w => voterIds.has(w.id))

        let eliminatedId: string
        let method: 'murdered' | 'random'

        if (allWolvesVoted && existingVotes.length > 0) {
            // Check if all votes point to the same target
            const targets = new Set(existingVotes.map(v => v.target_id))
            if (targets.size === 1) {
                // Unanimous
                eliminatedId = existingVotes[0].target_id
                method = 'murdered'
            } else {
                // Disagreement — random elimination from all alive players
                const randomIndex = Math.floor(Math.random() * alivePlayers.length)
                eliminatedId = alivePlayers[randomIndex].id
                method = 'random'
            }
        } else {
            // Missing votes — disagreement
            const randomIndex = Math.floor(Math.random() * alivePlayers.length)
            eliminatedId = alivePlayers[randomIndex].id
            method = 'random'
        }

        // 3. Resolve round
        await supabase
            .from('vote_rounds')
            .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
            })
            .eq('id', currentRound.id)

        // 4. Create elimination
        await supabase
            .from('eliminations')
            .insert({
                player_id: eliminatedId,
                round_id: currentRound.id,
                method,
                confirmed_by_gm: false,
            })

        // 5. Notify werewolves
        const targetName = players.find(p => p.id === eliminatedId)?.name ?? 'Inconnu'
        const notifMsg = method === 'murdered'
            ? `Meurtre réussi : ${targetName} a été éliminé.`
            : `Pas d'unanimité. Un joueur aléatoire a été éliminé : ${targetName}.`

        const notifs = aliveWerewolves.map(w => ({
            player_id: w.id,
            type: 'murder_result' as const,
            title: 'Résultat de la Chasse',
            message: notifMsg,
        }))
        await supabase.from('notifications').insert(notifs)

        setLastResult({ method, targetName })
        setIsResolving(false)
        fetchPendingMurder()
    }

    async function handleConfirmMurder() {
        if (!pendingElimination || !gameState) return
        setIsConfirming(true)

        // Confirm elimination
        await supabase
            .from('eliminations')
            .update({ confirmed_by_gm: true })
            .eq('id', pendingElimination.id)

        // Update player status
        await supabase
            .from('players')
            .update({ status: 'ghost' })
            .eq('id', pendingElimination.player_id)

        const victim = players.find(p => p.id === pendingElimination.player_id)

        // Update game state counts
        if (victim) {
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
            if (victim.role === 'werewolf') {
                updates.werewolf_count = Math.max(0, gameState.werewolf_count - 1)
            } else {
                updates.villager_count = Math.max(0, gameState.villager_count - 1)
            }
            await supabase.from('game_state').update(updates).eq('id', 1)
        }

        // Notify victim
        await supabase.from('notifications').insert({
            player_id: pendingElimination.player_id,
            type: 'eliminated' as const,
            title: 'Éliminé',
            message: 'Tu as été tué pendant la nuit.',
        })

        // Notify all players
        if (victim) {
            const notifs = players
                .filter(p => !p.is_gm && p.id !== pendingElimination.player_id)
                .map(p => ({
                    player_id: p.id,
                    type: 'eliminated' as const,
                    title: 'Mort suspecte',
                    message: `${victim.name} a été retrouvé mort.`,
                }))
            await supabase.from('notifications').insert(notifs)
        }

        // Check lone werewolf for infection
        if (victim?.role === 'werewolf') {
            const remainingWolves = players.filter(p => p.role === 'werewolf' && p.status === 'alive' && p.id !== pendingElimination.player_id)
            if (remainingWolves.length === 1 && gameState.phase !== 'final_vote') {
                const loneWolf = remainingWolves[0]
                await supabase.from('game_state').update({
                    metadata: { ...(gameState.metadata ?? {}), infection_pending: true, infector_id: loneWolf.id },
                    updated_at: new Date().toISOString(),
                }).eq('id', 1)

                await supabase.from('notifications').insert({
                    player_id: loneWolf.id,
                    type: 'infected' as const,
                    title: 'Dernier Loup',
                    message: 'Tu es le dernier loup. Choisis quelqu\'un à corrompre.',
                })
            }
        }

        setPendingElimination(null)
        setIsConfirming(false)
    }

    function getPlayerName(id: string) {
        return players.find(p => p.id === id)?.name ?? 'Inconnu'
    }

    return (
        <div className="min-h-screen bg-village-night p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-6">
                    🐺 Gestion des Meurtres
                </h1>

                {/* Werewolf info */}
                <div className="bg-blood-800/20 border border-blood-500/20 rounded-xl p-4 mb-6">
                    <h2 className="font-cinzel text-red-400/70 text-xs tracking-wider uppercase mb-2">Loups vivants</h2>
                    <div className="flex flex-wrap gap-2">
                        {aliveWerewolves.map(w => (
                            <span key={w.id} className="bg-blood-800/40 text-red-300 px-2 py-1 rounded font-crimson text-sm border border-blood-500/30">
                                🐺 {w.name}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Active murder round */}
                {isMurderRound ? (
                    <div className="bg-parchment-card rounded-xl p-5 mb-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-cinzel text-red-400 font-semibold tracking-wider uppercase text-sm">
                                Meurtre en cours
                            </h2>
                            {currentRound.timer_end_at && (
                                <CountdownTimer
                                    endTime={new Date(currentRound.timer_end_at)}
                                    onExpire={() => setTimerExpired(true)}
                                />
                            )}
                        </div>

                        {progress && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs font-crimson text-moon-400 mb-1">
                                    <span>Loups ayant voté</span>
                                    <span>{progress.votedCount} / {progress.totalVoters}</span>
                                </div>
                                <div className="h-2 bg-night-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blood-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progress.totalVoters ? (progress.votedCount / progress.totalVoters) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* GM can see who voted for whom */}
                        {votes.length > 0 && (
                            <div className="mb-4 space-y-1">
                                {votes.map(v => (
                                    <p key={v.id} className="font-crimson text-moon-400 text-sm">
                                        {getPlayerName(v.voter_id)} → <span className="text-red-400">{getPlayerName(v.target_id)}</span>
                                    </p>
                                ))}
                            </div>
                        )}

                        {timerExpired && (
                            <div className="bg-blood-800/60 border border-blood-500/50 rounded-lg p-3 mb-4 text-center">
                                <p className="text-red-300 font-crimson font-semibold">⏰ Temps écoulé — Ferme la chasse !</p>
                            </div>
                        )}

                        <button
                            onClick={handleCloseMurder}
                            disabled={isResolving}
                            className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                        >
                            {isResolving ? 'Résolution...' : '🔒 Fermer et résoudre le meurtre'}
                        </button>
                    </div>
                ) : (
                    <div className="bg-parchment-card rounded-xl p-5 mb-6 backdrop-blur-sm">
                        <h2 className="font-cinzel text-parchment-100 font-semibold mb-4 tracking-wider uppercase text-sm">
                            Ouvrir une fenêtre de meurtre
                        </h2>
                        <div className="mb-4">
                            <label className="font-crimson text-moon-400 text-sm block mb-1">
                                Durée : <span className="text-candle-400 font-semibold">{timerMinutes} min</span>
                            </label>
                            <input
                                type="range"
                                min={5}
                                max={120}
                                value={timerMinutes}
                                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                                className="w-full accent-blood-500"
                            />
                        </div>
                        <button
                            onClick={handleOpenMurder}
                            disabled={isCreating}
                            className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                        >
                            {isCreating ? 'Ouverture...' : '🐺 Ouvrir la fenêtre de meurtre'}
                        </button>
                    </div>
                )}

                {/* Pending murder confirmation */}
                {pendingElimination && (
                    <div className="bg-blood-800/30 border border-blood-500/40 rounded-xl p-5 mb-6">
                        <h2 className="font-cinzel text-red-400 font-semibold mb-3 tracking-wider uppercase text-sm">
                            Meurtre en attente de confirmation
                        </h2>
                        <p className="font-crimson text-parchment-200 mb-2">
                            Victime : <span className="text-red-400 font-semibold">{getPlayerName(pendingElimination.player_id)}</span>
                        </p>
                        <p className="font-crimson text-moon-400 text-sm mb-4">
                            Méthode : {pendingElimination.method === 'murdered' ? '🔪 Meurtre unanime' : '🎲 Élimination aléatoire (désaccord)'}
                        </p>
                        <button
                            onClick={handleConfirmMurder}
                            disabled={isConfirming}
                            className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                        >
                            {isConfirming ? 'Confirmation...' : '💀 Confirmer le meurtre'}
                        </button>
                    </div>
                )}

                {/* Last result */}
                {lastResult && (
                    <div className="bg-night-800/50 border border-night-700/30 rounded-xl p-4">
                        <p className="font-crimson text-moon-400 text-sm">
                            Dernier résultat : {lastResult.method === 'murdered' ? '🔪 Meurtre unanime' : '🎲 Élimination aléatoire'} — {lastResult.targetName}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
