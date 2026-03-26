import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useChallengeStore } from '../../stores/challengeStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { Leaderboard } from '../../components/Leaderboard'

export function GMMadScientistsPage() {
  const { challenges, scores, subscribeToAll, subscribeToChallenge } = useChallengeStore()
  const { players } = useRealtimePlayers()
  const [isCreating, setIsCreating] = useState(false)
  const [totalRounds, setTotalRounds] = useState(3)
  const [scientistCount, setScientistCount] = useState(4)
  const [pointsPerWin, setPointsPerWin] = useState(1)
  const [isAssigning, setIsAssigning] = useState(false)

  const challenge = challenges.find(c => c.type === 'mad_scientists')

  useEffect(() => {
    const unsub = subscribeToAll()
    return unsub
  }, [])

  useEffect(() => {
    if (!challenge) return
    const unsub = subscribeToChallenge(challenge.id)
    return unsub
  }, [challenge?.id])

  const metadata = (challenge?.metadata ?? {}) as Record<string, unknown>
  const currentRound = metadata.current_round as number ?? 0

  // Aggregate scores
  const playerScoreMap = new Map<string, number>()
  scores.forEach(s => {
    if (s.player_id) {
      playerScoreMap.set(s.player_id, (playerScoreMap.get(s.player_id) ?? 0) + s.score)
    }
  })
  const leaderboardScores = Array.from(playerScoreMap.entries())
    .map(([playerId, score]) => ({
      playerId,
      playerName: players.find(p => p.id === playerId)?.name ?? 'Inconnu',
      score,
    }))
    .sort((a, b) => b.score - a.score)

  // Players eligible (alive + ghosts can participate)
  const eligiblePlayers = players.filter(p => !p.is_gm && (p.status === 'alive' || p.status === 'ghost'))

  async function handleCreateChallenge() {
    setIsCreating(true)
    await supabase.from('challenges').insert({
      name: 'Savants Fous',
      type: 'mad_scientists' as const,
      status: 'active' as const,
      metadata: { total_rounds: totalRounds, current_round: 0, points_per_win: pointsPerWin },
    })
    setIsCreating(false)
  }

  async function handleAssignRoles() {
    if (!challenge) return
    setIsAssigning(true)

    const newRound = currentRound + 1

    // Shuffle and assign roles
    const shuffled = [...eligiblePlayers]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const scoreInserts = shuffled.map((p, idx) => ({
      challenge_id: challenge.id,
      player_id: p.id,
      round_number: newRound,
      score: 0,
      metadata: { mad_role: idx < scientistCount ? 'scientist' : 'citizen' },
    }))

    await supabase.from('challenge_scores').insert(scoreInserts)

    // Update challenge metadata
    await supabase
      .from('challenges')
      .update({
        metadata: { ...metadata, current_round: newRound },
        updated_at: new Date().toISOString(),
      })
      .eq('id', challenge.id)

    // Notify all players
    for (const p of eligiblePlayers) {
      await supabase.from('notifications').insert({
        player_id: p.id,
        type: 'challenge_update' as const,
        title: `🧪 Manche ${newRound}`,
        message: 'Les rôles ont été distribués ! Regarde ton rôle.',
      })
    }

    setIsAssigning(false)
  }

  async function handleSetWinner(winningRole: 'scientist' | 'citizen') {
    if (!challenge) return

    // Give points to all players of the winning role in the current round
    const currentRoundScores = scores.filter(s => s.round_number === currentRound)
    const winners = currentRoundScores.filter(
      s => (s.metadata as Record<string, unknown>)?.mad_role === winningRole
    )

    for (const w of winners) {
      await supabase
        .from('challenge_scores')
        .update({ score: pointsPerWin })
        .eq('id', w.id)
    }
  }

  async function handleEndChallenge() {
    if (!challenge) return
    await supabase
      .from('challenges')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', challenge.id)
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">🧪 Savants Fous (MJ)</h1>
          <Link to="/gm/challenges" className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Challenges</Link>
        </div>

        {!challenge && (
          <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
            <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
              Configurer Savants Fous
            </h2>
            <div className="space-y-3">
              <div>
                <label className="font-crimson text-moon-400 text-xs block mb-1">Nombre de manches</label>
                <input
                  type="number" min={1} max={10} value={totalRounds}
                  onChange={e => setTotalRounds(Number(e.target.value))}
                  className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson"
                />
              </div>
              <div>
                <label className="font-crimson text-moon-400 text-xs block mb-1">
                  Savants par manche : <span className="text-candle-400">{scientistCount}</span>
                </label>
                <input
                  type="range" min={1} max={Math.max(1, Math.floor(eligiblePlayers.length / 2))}
                  value={scientistCount}
                  onChange={e => setScientistCount(Number(e.target.value))}
                  className="w-full accent-candle-500"
                />
              </div>
              <div>
                <label className="font-crimson text-moon-400 text-xs block mb-1">Points par victoire</label>
                <input
                  type="number" min={1} max={5} value={pointsPerWin}
                  onChange={e => setPointsPerWin(Number(e.target.value))}
                  className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson"
                />
              </div>
              <button
                onClick={handleCreateChallenge}
                disabled={isCreating}
                className="w-full bg-gradient-to-b from-candle-500 to-candle-600 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all"
              >
                Créer Savants Fous
              </button>
            </div>
          </div>
        )}

        {challenge?.status === 'active' && (
          <div className="space-y-4">
            <div className="bg-parchment-card rounded-xl p-4 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-3">
                <p className="font-cinzel text-parchment-100 font-semibold text-sm">
                  Manche {currentRound} / {metadata.total_rounds as number ?? '?'}
                </p>
                <p className="font-crimson text-moon-400 text-xs">{eligiblePlayers.length} joueurs</p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleAssignRoles}
                  disabled={isAssigning}
                  className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-cinzel font-semibold hover:bg-purple-500 transition-colors disabled:opacity-40"
                >
                  {isAssigning ? 'Attribution...' : `🎲 Assigner les rôles (Manche ${currentRound + 1})`}
                </button>

                {currentRound > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSetWinner('scientist')}
                      className="bg-purple-600/20 border border-purple-500/30 text-purple-300 py-2 rounded-lg text-sm font-cinzel hover:bg-purple-600/30 transition-colors"
                    >
                      🧪 Savants gagnent
                    </button>
                    <button
                      onClick={() => handleSetWinner('citizen')}
                      className="bg-candle-600/20 border border-candle-500/30 text-candle-400 py-2 rounded-lg text-sm font-cinzel hover:bg-candle-500/30 transition-colors"
                    >
                      🏃 Citoyens gagnent
                    </button>
                  </div>
                )}

                {currentRound >= (metadata.total_rounds as number ?? 999) && (
                  <button
                    onClick={handleEndChallenge}
                    className="w-full bg-night-700 border border-night-600 text-moon-400 py-2 rounded-lg font-crimson hover:bg-night-600 transition-colors"
                  >
                    🏁 Terminer le challenge
                  </button>
                )}
              </div>
            </div>

            {/* Current round role assignments */}
            {currentRound > 0 && (
              <div className="bg-parchment-card rounded-xl p-4 backdrop-blur-sm">
                <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
                  Rôles — Manche {currentRound}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {scores
                    .filter(s => s.round_number === currentRound)
                    .map(s => {
                      const role = (s.metadata as Record<string, unknown>)?.mad_role as string
                      return (
                        <div key={s.id} className={`p-2 rounded-lg border text-xs font-crimson ${role === 'scientist'
                            ? 'bg-purple-900/20 border-purple-500/20 text-purple-300'
                            : 'bg-candle-600/10 border-candle-500/20 text-candle-400'
                          }`}>
                          {role === 'scientist' ? '🧪' : '🏃'} {players.find(p => p.id === s.player_id)?.name ?? '?'}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            <Leaderboard scores={leaderboardScores} title="Classement général" />
          </div>
        )}

        {challenge?.status === 'completed' && (
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🏆</div>
            <p className="font-cinzel text-candle-400 font-bold text-lg">Challenge terminé !</p>
            <Leaderboard scores={leaderboardScores} title="Classement final" className="mt-4" />
          </div>
        )}
      </div>
    </div>
  )
}
