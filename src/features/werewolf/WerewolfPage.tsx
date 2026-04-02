import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'
import { useVoteStore, getVoteProgress } from '../../stores/voteStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { CountdownTimer } from '../../components/ui/CountdownTimer'
import { supabase } from '../../lib/supabase'
import { GiWolfHead, GiBiohazard, GiNightSleep, GiBloodySword } from 'react-icons/gi'


export function WerewolfPage() {
    const { player } = useAuthStore()
    const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
    const { currentRound, votes, subscribeToRounds, subscribeToVotes, castVote } = useVoteStore()
    const { players } = useRealtimePlayers()
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
    const [showConfirm, setShowConfirm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [infectionTarget, setInfectionTarget] = useState<string | null>(null)
    const [isInfecting, setIsInfecting] = useState(false)

    useEffect(() => {
        fetchGameState()
        const unsub1 = subscribeToGameState()
        const unsub2 = subscribeToRounds()
        return () => { unsub1(); unsub2() }
    }, [])

    useEffect(() => {
        if (!currentRound || currentRound.type !== 'murder') return
        const unsub = subscribeToVotes(currentRound.id)
        return unsub
    }, [currentRound?.id])

    if (!player) return null

    const metadata = (gameState?.metadata ?? {}) as Record<string, unknown>
    const discoveryConfirmed = metadata.werewolf_discovery_confirmed === true
    const infectionPending = metadata.infection_pending === true
    const infectorId = metadata.infector_id as string | undefined
    const isLoneWolf = infectionPending && infectorId === player.id

    const aliveWerewolves = players.filter(p => p.role === 'werewolf' && p.status === 'alive' && !p.is_gm)
    const alivePlayers = players.filter(p => p.status === 'alive' && !p.is_gm)
    const aliveVillagers = alivePlayers.filter(p => p.role === 'villager')
    const voteTargets = alivePlayers // Werewolves can target anyone including other werewolves

    const isMurderRound = currentRound?.type === 'murder' && currentRound?.status === 'open'
    const progress = isMurderRound ? getVoteProgress(votes, aliveWerewolves, player.id) : null

    // Discovery not yet confirmed
    if (!discoveryConfirmed) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blood-900 via-night-950 to-night-950 flex flex-col items-center justify-center p-6">
                <div className="text-5xl mb-4"><GiWolfHead className="inline text-5xl" /></div>
                <h1 className="font-cinzel text-2xl font-bold text-red-400 tracking-wide mb-4">Meute des Loups</h1>
                <div className="bg-blood-800/30 border border-blood-500/30 rounded-xl p-6 max-w-sm text-center">
                    <p className="font-crimson text-red-300/80 italic">
                        Retrouve tes compagnons au point de rendez-vous secret. Une fois réunis, le MJ débloquera votre tanière.
                    </p>
                </div>
            </div>
        )
    }

    async function handleConfirmMurderVote() {
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

    async function handleSubmitInfection() {
        if (!infectionTarget || !gameState) return
        setIsInfecting(true)

        await supabase.from('game_state').update({
            metadata: { ...(gameState.metadata ?? {}), infection_target: infectionTarget },
            updated_at: new Date().toISOString(),
        }).eq('id', 1)

        setIsInfecting(false)
    }

    const selectedTargetPlayer = voteTargets.find(p => p.id === selectedTarget)

    return (
        <div className="min-h-screen bg-gradient-to-b from-blood-900 via-night-950 to-night-950 p-6">
            <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="text-3xl mb-2"><GiWolfHead className="inline text-3xl" /></div>
                    <h1 className="font-cinzel text-2xl font-bold text-red-400 tracking-wide">
                        Tanière des Loups
                    </h1>
                </div>

                {/* Pack members */}
                <div className="bg-blood-800/20 border border-blood-500/20 rounded-xl p-4 mb-6">
                    <h2 className="font-cinzel text-red-400/70 text-xs tracking-wider uppercase mb-3">Ta meute</h2>
                    <div className="space-y-2">
                        {aliveWerewolves.map(w => (
                            <div key={w.id} className="flex items-center gap-2">
                                <span className="text-sm"><GiWolfHead className="inline" /></span>
                                <span className="font-crimson text-red-200">
                                    {w.name}
                                    {w.id === player.id && <span className="text-red-400/50 ml-1 italic text-sm">(toi)</span>}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Infection flow (PBI-9) */}
                {isLoneWolf && (
                    <div className="bg-blood-800/30 border border-blood-500/40 rounded-xl p-5 mb-6">
                        <h2 className="font-cinzel text-red-400 font-semibold text-sm tracking-wider uppercase mb-3">
                            <GiBiohazard className="inline" /> Infection
                        </h2>
                        <p className="font-crimson text-red-300/80 text-sm mb-4">
                            Tu es le dernier loup. Choisis un villageois à corrompre.
                        </p>

                        {(metadata.infection_target) ? (
                            <p className="font-crimson text-red-200 italic text-center">
                                En attente de confirmation du MJ...
                            </p>
                        ) : (
                            <>
                                <div className="space-y-2 mb-4">
                                    {aliveVillagers.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setInfectionTarget(p.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all border ${infectionTarget === p.id
                                                ? 'bg-blood-800/40 border-blood-500/50'
                                                : 'bg-night-800/50 border-night-700/30 hover:bg-night-700/50'
                                                }`}
                                        >
                                            <div className={`w-3 h-3 rounded-full border-2 ${infectionTarget === p.id ? 'border-blood-500 bg-blood-500' : 'border-moon-400/50'
                                                }`} />
                                            <span className="font-crimson text-parchment-200">{p.name}</span>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={handleSubmitInfection}
                                    disabled={!infectionTarget || isInfecting}
                                    className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 disabled:from-night-700 disabled:to-night-700 disabled:text-night-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                                >
                                    {isInfecting ? '...' : <><GiBiohazard className="inline" /> Corrompre</>}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Murder round active */}
                {isMurderRound ? (
                    <div className="bg-blood-800/20 border border-blood-500/20 rounded-xl p-5 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-cinzel text-red-400 font-semibold text-sm tracking-wider uppercase">
                                La Chasse
                            </h2>
                            {currentRound.timer_end_at && (
                                <CountdownTimer endTime={new Date(currentRound.timer_end_at)} />
                            )}
                        </div>

                        {/* Progress */}
                        {progress && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs font-crimson text-red-400/70 mb-1">
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

                        {error && (
                            <div className="bg-blood-800/60 border border-blood-500/50 rounded-lg p-3 mb-4 text-center">
                                <p className="text-red-300 font-crimson text-sm">{error}</p>
                            </div>
                        )}

                        {/* Already voted */}
                        {progress?.hasCurrentPlayerVoted ? (
                            <div className="text-center">
                                <p className="font-crimson text-red-200 italic">En attente des autres loups...</p>
                            </div>
                        ) : (
                            <>
                                {/* Target selection */}
                                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                                    {voteTargets.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => setSelectedTarget(p.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all border ${selectedTarget === p.id
                                                ? 'bg-blood-800/40 border-blood-500/50'
                                                : 'bg-night-800/50 border-night-700/30 hover:bg-night-700/50'
                                                }`}
                                        >
                                            <div className={`w-3 h-3 rounded-full border-2 ${selectedTarget === p.id ? 'border-blood-500 bg-blood-500' : 'border-moon-400/50'
                                                }`} />
                                            <span className="font-crimson text-parchment-200">{p.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setShowConfirm(true)}
                                    disabled={!selectedTarget}
                                    className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 disabled:from-night-700 disabled:to-night-700 disabled:text-night-600 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all"
                                >
                                    Confirmer la cible
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    /* No murder round active */
                    <div className="bg-night-800/30 rounded-xl p-4 border border-night-700/30 border-dashed">
                        <p className="text-red-400/40 text-center text-sm font-crimson italic">
                            <GiNightSleep className="inline" /> La fenêtre de chasse n'est pas ouverte. Patientez...
                        </p>
                    </div>
                )}
            </div>

            {/* Confirmation modal */}
            {showConfirm && selectedTargetPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70">
                    <div className="bg-night-800 border border-blood-500/30 rounded-xl p-6 max-w-sm w-full">
                        <div className="text-center">
                            <div className="text-3xl mb-3"><GiBloodySword className="inline text-3xl" /></div>
                            <h2 className="font-cinzel text-red-400 text-lg font-semibold mb-2">Confirmer la cible</h2>
                            <p className="font-crimson text-moon-400 mb-6">
                                Tu choisis d'éliminer <span className="text-red-400 font-semibold">{selectedTargetPlayer.name}</span>.
                                <br />
                                <span className="text-xs italic">Tous les loups doivent être unanimes.</span>
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
                                    onClick={handleConfirmMurderVote}
                                    disabled={isSubmitting}
                                    className="flex-1 bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-2.5 rounded-lg transition-all"
                                >
                                    {isSubmitting ? '...' : 'Confirmer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
