import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useVoteStore, getVoteProgress } from '../../stores/voteStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { CountdownTimer } from '../../components/ui/CountdownTimer'

export function VotePage() {
    const { player } = useAuthStore()
    const { currentRound, votes, subscribeToRounds, subscribeToVotes, castVote } = useVoteStore()
    const { players } = useRealtimePlayers()
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
    const [showConfirm, setShowConfirm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const unsub = subscribeToRounds()
        return unsub
    }, [])

    // Subscribe to votes when a round is active
    useEffect(() => {
        if (!currentRound) return
        const unsub = subscribeToVotes(currentRound.id)
        return unsub
    }, [currentRound?.id])

    if (!player) return null

    const alivePlayers = players.filter(p => p.status === 'alive' && !p.is_gm)
    const voteTargets = alivePlayers.filter(p => p.id !== player.id)
    const progress = getVoteProgress(votes, alivePlayers, player.id)

    // No active round
    if (!currentRound || (currentRound.type !== 'council' && currentRound.type !== 'final') || currentRound.metadata?.subtype === 'continue_poll') {
        return (
            <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
                <div className="text-4xl mb-4">🗳️</div>
                <p className="font-cinzel text-parchment-200 text-xl mb-2">Aucun vote en cours</p>
                <p className="font-crimson text-moon-400 italic text-center">
                    Retourne au village et attends l'appel du Maître du Jeu.
                </p>
            </div>
        )
    }

    // Already voted
    if (progress.hasCurrentPlayerVoted) {
        return (
            <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
                <div className="text-4xl mb-4">✅</div>
                <p className="font-cinzel text-parchment-200 text-xl mb-2">Vote enregistré</p>
                <p className="font-crimson text-moon-400 italic text-center mb-6">
                    En attente des autres villageois...
                </p>

                {currentRound.timer_end_at && (
                    <CountdownTimer endTime={new Date(currentRound.timer_end_at)} />
                )}

                {/* Progress bar */}
                <div className="w-full max-w-xs mt-6">
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
            </div>
        )
    }

    async function handleConfirmVote() {
        if (!selectedTarget || !currentRound || !player) return
        setIsSubmitting(true)
        setError(null)

        const result = await castVote(currentRound.id, player.id, selectedTarget)
        if (!result.success) {
            setError(result.error ?? 'Erreur lors du vote')
        }

        setIsSubmitting(false)
        setShowConfirm(false)
    }

    const selectedTargetPlayer = voteTargets.find(p => p.id === selectedTarget)

    return (
        <div className="min-h-screen bg-village-night p-6">
            <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="text-3xl mb-2">🗳️</div>
                    <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">
                        Conseil du Village
                    </h1>
                    <p className="font-crimson text-moon-400 italic mt-1">
                        Choisis qui sera éliminé
                    </p>
                </div>

                {/* Timer */}
                {currentRound.timer_end_at && (
                    <div className="text-center mb-6">
                        <CountdownTimer endTime={new Date(currentRound.timer_end_at)} />
                    </div>
                )}

                {/* Progress */}
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

                {error && (
                    <div className="bg-blood-800/60 border border-blood-500/50 rounded-lg p-3 mb-4 text-center">
                        <p className="text-red-300 font-crimson text-sm">{error}</p>
                    </div>
                )}

                {/* Player list to vote for */}
                <div className="space-y-2 mb-6">
                    {voteTargets.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedTarget(p.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all border ${selectedTarget === p.id
                                ? 'bg-blood-800/40 border-blood-500/50 shadow-lg shadow-blood-900/20'
                                : 'bg-night-800/50 border-night-700/30 hover:bg-night-700/50'
                                }`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${selectedTarget === p.id
                                ? 'border-blood-500 bg-blood-500'
                                : 'border-moon-400/50'
                                }`} />
                            <span className="font-crimson text-parchment-200">{p.name}</span>
                        </button>
                    ))}
                </div>

                {/* Confirm button */}
                <button
                    onClick={() => setShowConfirm(true)}
                    disabled={!selectedTarget}
                    className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 disabled:from-night-700 disabled:to-night-700 disabled:text-night-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blood-700/30"
                >
                    Confirmer le vote
                </button>
            </div>

            {/* Confirmation modal */}
            {showConfirm && selectedTargetPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70">
                    <div className="bg-night-800 border border-night-600 rounded-xl p-6 max-w-sm w-full">
                        <div className="text-center">
                            <div className="text-3xl mb-3">⚠️</div>
                            <h2 className="font-cinzel text-parchment-100 text-lg font-semibold mb-2">
                                Confirmer ton vote
                            </h2>
                            <p className="font-crimson text-moon-400 mb-6">
                                Tu votes pour éliminer <span className="text-red-400 font-semibold">{selectedTargetPlayer.name}</span>.
                                <br />
                                <span className="text-xs italic">Ce vote est définitif.</span>
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 bg-night-700 hover:bg-night-600 text-parchment-200 font-crimson py-2.5 rounded-lg transition-colors border border-night-600"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleConfirmVote}
                                    disabled={isSubmitting}
                                    className="flex-1 bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-2.5 rounded-lg transition-all"
                                >
                                    {isSubmitting ? '...' : 'Voter'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
