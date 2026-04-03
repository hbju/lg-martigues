import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useVoteStore, getVoteProgress } from '../../stores/voteStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { useGameStore } from '../../stores/gameStore'
import { CountdownTimer } from '../../components/ui/CountdownTimer'
import type { VoteRound, Vote, Elimination } from '../../types/supabase'
import { GiVote, GiFinishLine, GiDeathSkull } from 'react-icons/gi'
import { RiLockFill, RiSearchLine, RiRefreshLine, RiErrorWarningFill, RiAlarmWarningFill } from 'react-icons/ri'

export function GMVotesPage() {
    const { player } = useAuthStore()
    const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
    const { currentRound, votes, subscribeToRounds, subscribeToVotes } = useVoteStore()
    const { players } = useRealtimePlayers()
    const [timerMinutes, setTimerMinutes] = useState(15)
    const [isCreating, setIsCreating] = useState(false)
    const [isResolving, setIsResolving] = useState(false)
    const [resolvedRound, setResolvedRound] = useState<VoteRound | null>(null)
    const [resolvedVotes, setResolvedVotes] = useState<Vote[]>([])
    const [pendingElimination, setPendingElimination] = useState<Elimination | null>(null)
    const [isConfirming, setIsConfirming] = useState(false)
    const [timerExpired, setTimerExpired] = useState(false)

    useEffect(() => {
        const unsub = subscribeToRounds()
        return unsub
    }, [])

    useEffect(() => {
        fetchGameState()
        const unsub = subscribeToGameState()
        return unsub
    }, [])

    useEffect(() => {
        if (!currentRound) return
        const unsub = subscribeToVotes(currentRound.id)
        return unsub
    }, [currentRound?.id])

    // Fetch latest resolved round on load
    useEffect(() => {
        fetchLatestResolved()
    }, [])

    async function fetchLatestResolved() {
        const { data: round } = await supabase
            .from('vote_rounds')
            .select('*')
            .eq('status', 'resolved')
            .order('resolved_at', { ascending: false })
            .limit(1)
            .overrideTypes<VoteRound[]>()

        if (round?.[0]) {
            setResolvedRound(round[0])

            const { data: roundVotes } = await supabase
                .from('votes')
                .select('*')
                .eq('round_id', round[0].id)
                .overrideTypes<Vote[]>()

            if (roundVotes) setResolvedVotes(roundVotes)

            // Check for pending elimination
            const { data: elim } = await supabase
                .from('eliminations')
                .select('*')
                .eq('round_id', round[0].id)
                .eq('confirmed_by_gm', false)
                .overrideTypes<Elimination[]>()

            if (elim?.[0]) setPendingElimination(elim[0])
        }
    }

    if (!player) return null

    const alivePlayers = players.filter(p => p.status === 'alive' && !p.is_gm)
    const progress = currentRound ? getVoteProgress(votes, alivePlayers, player.id) : null

    async function handleOpenVote() {
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

        // Create vote round
        const { data: round } = await supabase
            .from('vote_rounds')
            .insert({
                type: 'council' as const,
                status: 'open' as const,
                timer_duration_seconds: timerMinutes * 60,
                timer_started_at: now.toISOString(),
                timer_end_at: endAt.toISOString(),
                created_by: player.id,
            })
            .select()
            .single<VoteRound>()

        // Send notifications to all alive players
        if (round) {
            const notifs = alivePlayers.map(p => ({
                player_id: p.id,
                type: 'vote_open' as const,
                title: 'Conseil du Village',
                message: `Un vote a été ouvert ! Tu as ${timerMinutes} minutes pour voter.`,
            }))

            await supabase.from('notifications').insert(notifs)
        }

        setTimerExpired(false)
        setIsCreating(false)
    }

    async function handleCloseVote() {
        if (!currentRound) return
        setIsResolving(true)

        // 1. Fetch all votes
        const { data: allVotes } = await supabase
            .from('votes')
            .select('*')
            .eq('round_id', currentRound.id)
            .overrideTypes<Vote[]>()

        const existingVotes = allVotes ?? []

        // 2. Find players who didn't vote — assign random targets
        const voterIds = new Set(existingVotes.map(v => v.voter_id))
        const nonVoters = alivePlayers.filter(p => !voterIds.has(p.id))

        for (const nv of nonVoters) {
            const possibleTargets = alivePlayers.filter(p => p.id !== nv.id)
            const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)]
            if (randomTarget) {
                await supabase
                    .from('votes')
                    .insert({
                        round_id: currentRound.id,
                        voter_id: nv.id,
                        target_id: randomTarget.id,
                        is_random: true,
                    })
            }
        }

        // 3. Re-fetch all votes
        const { data: finalVotes } = await supabase
            .from('votes')
            .select('*')
            .eq('round_id', currentRound.id)
            .overrideTypes<Vote[]>()

        const allFinalVotes = finalVotes ?? []

        // 4. Tally votes
        const tally: Record<string, number> = {}
        for (const v of allFinalVotes) {
            tally[v.target_id] = (tally[v.target_id] ?? 0) + 1
        }

        const maxVotes = Math.max(...Object.values(tally), 0)
        const candidates = Object.entries(tally)
            .filter(([, count]) => count === maxVotes)
            .map(([id]) => id)

        // In case of tie, pick random among tied
        const eliminatedId = candidates[Math.floor(Math.random() * candidates.length)]

        // 5. Mark round resolved
        await supabase
            .from('vote_rounds')
            .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
            })
            .eq('id', currentRound.id)

        // 6. Create elimination
        if (eliminatedId) {
            await supabase
                .from('eliminations')
                .insert({
                    player_id: eliminatedId,
                    round_id: currentRound.id,
                    method: 'voted',
                    confirmed_by_gm: false,
                })
        }

        // 7. Send notification to each voter with their vote info
        for (const v of allFinalVotes) {
            const targetName = alivePlayers.find(p => p.id === v.target_id)?.name ?? 'Inconnu'
            await supabase.from('notifications').insert({
                player_id: v.voter_id,
                type: 'vote_result' as const,
                title: 'Résultat du vote',
                message: v.is_random
                    ? `Tu n'as pas voté à temps. Ton vote a été attribué au hasard à ${targetName}.`
                    : `Tu as voté pour ${targetName}.`,
            })
        }

        setIsResolving(false)
        fetchLatestResolved()
    }

    async function handleConfirmElimination() {
        if (!pendingElimination) return
        setIsConfirming(true)

        // Update elimination
        await supabase
            .from('eliminations')
            .update({ confirmed_by_gm: true })
            .eq('id', pendingElimination.id)

        // Update player status to ghost
        await supabase
            .from('players')
            .update({ status: 'ghost' })
            .eq('id', pendingElimination.player_id)

        const eliminatedPlayer = players.find(p => p.id === pendingElimination.player_id)

        // Update game state counts
        if (eliminatedPlayer && gameState) {
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
            if (eliminatedPlayer.role === 'werewolf') {
                updates.werewolf_count = Math.max(0, gameState.werewolf_count - 1)
            } else {
                updates.villager_count = Math.max(0, gameState.villager_count - 1)
            }
            await supabase.from('game_state').update(updates).eq('id', 1)
        }

        // Notify all players
        if (eliminatedPlayer) {
            const notifs = players
                .filter(p => !p.is_gm && p.id !== pendingElimination.player_id)
                .map(p => ({
                    player_id: p.id,
                    type: 'eliminated' as const,
                    title: 'Élimination',
                    message: `${eliminatedPlayer.name} a été éliminé par le conseil.`,
                }))
            await supabase.from('notifications').insert(notifs)
        }

        // Check lone werewolf for infection
        if (eliminatedPlayer?.role === 'werewolf' && gameState) {
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

    // ─── FINAL VOTE FUNCTIONS ───

    const isFinalVote = gameState?.phase === 'final_vote' || gameState?.is_final_vote

    async function handleEnterFinalVote() {
        if (!confirm('Entrer en mode Vote Final ? (6 joueurs restants)')) return
        await supabase.from('game_state').update({
            phase: 'final_vote',
            is_final_vote: true,
            updated_at: new Date().toISOString(),
        }).eq('id', 1)

        // Notify all players
        const notifs = alivePlayers.map(p => ({
            player_id: p.id,
            type: 'final_vote_start' as const,
            title: 'Vote Final',
            message: 'Le Vote Final commence ! Éliminez les derniers suspects.',
        }))
        await supabase.from('notifications').insert(notifs)
    }

    async function handleOpenFinalVote() {
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
                type: 'final' as const,
                status: 'open' as const,
                timer_duration_seconds: timerMinutes * 60,
                timer_started_at: now.toISOString(),
                timer_end_at: endAt.toISOString(),
                created_by: player.id,
            })
            .select()
            .single<VoteRound>()

        if (round) {
            const notifs = alivePlayers.map(p => ({
                player_id: p.id,
                type: 'vote_open' as const,
                title: 'Vote Final',
                message: `Un vote final a été ouvert ! Tu as ${timerMinutes} minutes.`,
            }))
            await supabase.from('notifications').insert(notifs)
        }

        setTimerExpired(false)
        setIsCreating(false)
    }

    async function handleOpenContinuePoll() {
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
        const endAt = new Date(now.getTime() + 2 * 60 * 1000) // 2 minutes

        await supabase.from('vote_rounds').insert({
            type: 'final' as const,
            status: 'open' as const,
            timer_duration_seconds: 120,
            timer_started_at: now.toISOString(),
            timer_end_at: endAt.toISOString(),
            created_by: player.id,
            metadata: { subtype: 'continue_poll' },
        })

        const notifs = alivePlayers.map(p => ({
            player_id: p.id,
            type: 'continue_poll' as const,
            title: 'Continuer ou arrêter ?',
            message: 'Votez : pensez-vous qu\'il reste des loups parmi vous ?',
        }))
        await supabase.from('notifications').insert(notifs)
        setIsCreating(false)
    }

    async function handleResolveContinuePoll() {
        if (!currentRound) return
        setIsResolving(true)

        // Fetch all votes for this poll
        const { data: pollVotes } = await supabase
            .from('votes')
            .select('*')
            .eq('round_id', currentRound.id)

        const allVotes = (pollVotes ?? []) as (Vote & { metadata?: Record<string, unknown> })[]

        // Count choices
        let continueCount = 0
        let stopCount = 0
        for (const v of allVotes) {
            const choice = (v as unknown as { metadata?: { choice?: string } }).metadata?.choice
            if (choice === 'continue') continueCount++
            else if (choice === 'stop') stopCount++
        }

        // Mark round resolved
        await supabase.from('vote_rounds').update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            metadata: { ...currentRound.metadata, result: continueCount > stopCount ? 'continue' : 'stop', continue_count: continueCount, stop_count: stopCount },
        }).eq('id', currentRound.id)

        if (continueCount <= stopCount) {
            // Group decided to stop → trigger final reveal
            await handleTriggerFinalReveal()
        }

        setIsResolving(false)
        fetchLatestResolved()
    }

    async function handleTriggerFinalReveal() {
        // Determine winner
        const wolves = players.filter(p => p.role === 'werewolf' && p.status === 'alive')
        const winner = wolves.length > 0 ? 'werewolves' : 'villagers'
        const survivors = players.filter(p => p.status === 'alive' && !p.is_gm).map(p => ({
            id: p.id, name: p.name, role: p.role,
        }))

        const meta = (gameState?.metadata ?? {}) as Record<string, unknown>
        await supabase.from('game_state').update({
            phase: 'finished',
            metadata: { ...meta, winner, survivors, tv_state: { scene: 'final_reveal' } },
            updated_at: new Date().toISOString(),
        }).eq('id', 1)

        // Notify all players
        const notifs = players.filter(p => !p.is_gm).map(p => ({
            player_id: p.id,
            type: 'game_over' as const,
            title: 'Fin de la partie !',
            message: winner === 'werewolves'
                ? 'Les Loups-Garous ont gagné ! Découvre la révélation finale.'
                : 'Les Villageois ont gagné ! Découvre la révélation finale.',
        }))
        await supabase.from('notifications').insert(notifs)
    }

    async function handleForceEndGame() {
        if (!confirm('Terminer la partie maintenant ? Cette action est irréversible.')) return
        await handleTriggerFinalReveal()
    }

    async function handleResetGame() {
        if (!confirm('RÉINITIALISER toute la partie ? Toutes les données seront effacées.')) return
        if (!confirm('Es-tu VRAIMENT sûr ? Dernière chance...')) return

        // Reset all players to pending
        await supabase.from('players').update({
            role: null,
            status: 'pending',
            shields: 0,
            clairvoyance_count: 0,
        }).neq('is_gm', true)

        // Reset game state
        await supabase.from('game_state').update({
            phase: 'setup',
            current_round: 0,
            is_final_vote: false,
            werewolf_count: 3,
            villager_count: 13,
            metadata: null,
            updated_at: new Date().toISOString(),
        }).eq('id', 1)

        // Delete all vote rounds, votes, eliminations, notifications, power-ups
        await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('eliminations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('vote_rounds').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('power_ups').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        alert('Partie réinitialisée !')
    }

    function getPlayerName(id: string) {
        return players.find(p => p.id === id)?.name ?? 'Inconnu'
    }

    return (
        <div className="min-h-screen bg-village-night p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-6">
                    <GiVote className="inline" /> Gestion des Votes
                </h1>

                {/* Current round status */}
                {currentRound && currentRound.status === 'open' ? (
                    <div className="bg-parchment-card rounded-xl p-5 mb-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-cinzel text-candle-400 font-semibold tracking-wider uppercase text-sm">
                                Vote en cours — {currentRound.type === 'final' ? 'Vote Final' : currentRound.type === 'council' ? 'Conseil' : 'Meurtre'}
                            </h2>
                            {currentRound.timer_end_at && (
                                <CountdownTimer
                                    endTime={new Date(currentRound.timer_end_at)}
                                    onExpire={() => setTimerExpired(true)}
                                />
                            )}
                        </div>

                        {/* Vote progress */}
                        {progress && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs font-crimson text-moon-400 mb-1">
                                    <span>Votes reçus</span>
                                    <span>{progress.votedCount} / {progress.totalVoters}</span>
                                </div>
                                <div className="h-2 bg-night-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-candle-400 rounded-full transition-all duration-500"
                                        style={{ width: `${progress.totalVoters ? (progress.votedCount / progress.totalVoters) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {timerExpired && (
                            <div className="bg-blood-800/60 border border-blood-500/50 rounded-lg p-3 mb-4 text-center">
                                <p className="text-red-300 font-crimson font-semibold"><RiAlarmWarningFill className="inline" /> Le temps est écoulé — Ferme le vote maintenant !</p>
                            </div>
                        )}

                        <button
                            onClick={handleCloseVote}
                            disabled={isResolving}
                            className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                        >
                            {isResolving ? 'Résolution en cours...' : <><RiLockFill className="inline" /> Fermer le vote et résoudre</>}
                        </button>
                    </div>
                ) : (
                    /* No active round — show create button */
                    <div className="bg-parchment-card rounded-xl p-5 mb-6 backdrop-blur-sm">
                        <h2 className="font-cinzel text-parchment-100 font-semibold mb-4 tracking-wider uppercase text-sm">
                            Ouvrir un vote
                        </h2>
                        <div className="mb-4">
                            <label className="font-crimson text-moon-400 text-sm block mb-1">
                                Durée du timer : <span className="text-candle-400 font-semibold">{timerMinutes} min</span>
                            </label>
                            <input
                                type="range"
                                min={1}
                                max={30}
                                value={timerMinutes}
                                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                                className="w-full accent-candle-500"
                            />
                        </div>
                        <button
                            onClick={handleOpenVote}
                            disabled={isCreating}
                            className="w-full bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all shadow-lg shadow-candle-500/20"
                        >
                            {isCreating ? 'Ouverture...' : <><GiVote className="inline" /> Ouvrir un vote du Conseil</>}
                        </button>
                    </div>
                )}

                {/* Final Vote mode prompt */}
                {!isFinalVote && alivePlayers.length <= 6 && gameState?.phase === 'playing' && !currentRound?.status && (
                    <div className="bg-blood-800/20 border border-blood-500/30 rounded-xl p-5 mb-6 animate-pulse">
                        <h2 className="font-cinzel text-red-400 font-semibold mb-3 tracking-wider uppercase text-sm">
                            <GiVote className="inline" /> Vote Final disponible
                        </h2>
                        <p className="font-crimson text-parchment-200 mb-4">
                            Il ne reste que <span className="text-candle-400 font-semibold">{alivePlayers.length}</span> joueurs.
                            Tu peux activer le mode Vote Final.
                        </p>
                        <button
                            onClick={handleEnterFinalVote}
                            className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                        >
                            Activer le Vote Final
                        </button>
                    </div>
                )}

                {/* Final Vote controls */}
                {isFinalVote && !currentRound?.status && (
                    <div className="bg-blood-800/10 border border-blood-500/20 rounded-xl p-5 mb-6">
                        <h2 className="font-cinzel text-red-400 font-semibold mb-4 tracking-wider uppercase text-sm">
                            <GiVote className="inline" /> Mode Vote Final
                        </h2>
                        <div className="mb-4">
                            <label className="font-crimson text-moon-400 text-sm block mb-1">
                                Durée du timer : <span className="text-candle-400 font-semibold">{timerMinutes} min</span>
                            </label>
                            <input
                                type="range"
                                min={1}
                                max={15}
                                value={timerMinutes}
                                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                                className="w-full accent-candle-500"
                            />
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={handleOpenFinalVote}
                                disabled={isCreating}
                                className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                            >
                                {isCreating ? 'Ouverture...' : <><GiVote className="inline" /> Ouvrir un vote final</>}
                            </button>
                            <button
                                onClick={handleOpenContinuePoll}
                                disabled={isCreating}
                                className="w-full bg-night-800 hover:bg-night-700 text-parchment-200 font-crimson py-3 rounded-lg transition-colors border border-night-600"
                            >
                                {isCreating ? 'Ouverture...' : <><RiSearchLine className="inline" /> Sondage : Continuer ou Arrêter ?</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Continue poll resolution */}
                {currentRound?.status === 'open' && currentRound.metadata?.subtype === 'continue_poll' && (
                    <div className="bg-parchment-card rounded-xl p-5 mb-6 backdrop-blur-sm">
                        <h2 className="font-cinzel text-candle-400 font-semibold tracking-wider uppercase text-sm mb-4">
                            Sondage en cours — Continuer ou Arrêter ?
                        </h2>
                        {currentRound.timer_end_at && (
                            <div className="mb-4">
                                <CountdownTimer
                                    endTime={new Date(currentRound.timer_end_at)}
                                    onExpire={() => setTimerExpired(true)}
                                />
                            </div>
                        )}
                        <button
                            onClick={handleResolveContinuePoll}
                            disabled={isResolving}
                            className="w-full bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all"
                        >
                            {isResolving ? 'Résolution...' : <><RiLockFill className="inline" /> Fermer le sondage et résoudre</>}
                        </button>
                    </div>
                )}

                {/* GM Emergency controls */}
                {gameState && gameState.phase !== 'setup' && (
                    <div className="bg-night-800/30 border border-night-700/30 rounded-xl p-4 mb-6">
                        <h2 className="font-cinzel text-moon-400/60 font-semibold mb-3 tracking-wider uppercase text-xs">
                            <RiErrorWarningFill className="inline" /> Actions d'urgence
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleForceEndGame}
                                className="bg-blood-800/30 hover:bg-blood-800/50 border border-blood-500/30 text-red-400 font-crimson py-2 px-3 rounded-lg transition-colors text-sm"
                            >
                                <GiFinishLine className="inline" /> Fin de partie
                            </button>
                            <button
                                onClick={handleResetGame}
                                className="bg-blood-800/30 hover:bg-blood-800/50 border border-blood-500/30 text-red-400 font-crimson py-2 px-3 rounded-lg transition-colors text-sm"
                            >
                                <RiRefreshLine className="inline" /> Réinitialiser
                            </button>
                        </div>
                    </div>
                )}

                {/* Pending elimination confirmation */}
                {pendingElimination && (
                    <div className="bg-blood-800/30 border border-blood-500/40 rounded-xl p-5 mb-6">
                        <h2 className="font-cinzel text-red-400 font-semibold mb-3 tracking-wider uppercase text-sm">
                            Élimination en attente
                        </h2>
                        <p className="font-crimson text-parchment-200 mb-4">
                            <span className="text-red-400 font-semibold">{getPlayerName(pendingElimination.player_id)}</span> doit être éliminé.
                        </p>
                        <button
                            onClick={handleConfirmElimination}
                            disabled={isConfirming}
                            className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                        >
                            {isConfirming ? 'Confirmation...' : <><GiDeathSkull className="inline" /> Confirmer l'élimination</>}
                        </button>
                    </div>
                )}

                {/* Last resolved round results (GM sees full breakdown) */}
                {resolvedRound && resolvedVotes.length > 0 && (
                    <div className="bg-parchment-card rounded-xl p-5 backdrop-blur-sm">
                        <h2 className="font-cinzel text-parchment-100 font-semibold mb-3 tracking-wider uppercase text-sm">
                            Dernier vote — Résultats complets
                        </h2>

                        {/* Tally */}
                        {(() => {
                            const tally: Record<string, { count: number; voters: string[] }> = {}
                            for (const v of resolvedVotes) {
                                if (!tally[v.target_id]) tally[v.target_id] = { count: 0, voters: [] }
                                tally[v.target_id].count++
                                tally[v.target_id].voters.push(getPlayerName(v.voter_id) + (v.is_random ? ' (aléatoire)' : ''))
                            }

                            const sorted = Object.entries(tally).sort(([, a], [, b]) => b.count - a.count)

                            return (
                                <div className="space-y-3">
                                    {sorted.map(([targetId, data]) => (
                                        <div key={targetId} className="bg-night-800/50 rounded-lg p-3 border border-night-700/30">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-crimson text-parchment-200 font-semibold">
                                                    {getPlayerName(targetId)}
                                                </span>
                                                <span className="font-cinzel text-candle-400 font-bold">{data.count} vote{data.count > 1 ? 's' : ''}</span>
                                            </div>
                                            <p className="font-crimson text-moon-400 text-xs">
                                                {data.voters.join(', ')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}
                    </div>
                )}
            </div>
        </div>
    )
}
