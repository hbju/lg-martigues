import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useChallengeStore } from '../../stores/challengeStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { Leaderboard } from '../../components/Leaderboard'
import type { ChallengeScore } from '../../types/supabase'

export function MadScientistsPage() {
  const { player } = useAuthStore()
  const { challenges, scores, subscribeToAll, subscribeToChallenge } = useChallengeStore()
  const { players } = useRealtimePlayers()
  const navigate = useNavigate()

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

  // Current round info
  const metadata = (challenge?.metadata ?? {}) as Record<string, unknown>
  const currentRound = metadata.current_round as number ?? 0
  const totalRounds = metadata.total_rounds as number ?? 3

  // Find my role for current round
  const myCurrentScore = scores.find(
    s => s.player_id === player?.id && s.round_number === currentRound
  )
  const myRole = (myCurrentScore?.metadata as Record<string, unknown>)?.mad_role as string | null

  // Aggregate scores per player
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

  if (!player) return null

  if (!challenge) {
    return (
      <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">🧪</div>
        <p className="font-cinzel text-parchment-100 text-xl mb-2">Savants Fous</p>
        <p className="font-crimson text-moon-400 italic">Le challenge n'a pas encore été créé par le MJ.</p>
        <button onClick={() => navigate('/home')} className="mt-4 text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Retour</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">🧪 Savants Fous</h1>
            <p className="font-crimson text-moon-400 text-sm italic">
              Manche {currentRound} / {totalRounds}
              {challenge.status === 'completed' && ' — Terminé'}
            </p>
          </div>
          <button onClick={() => navigate('/home')} className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Retour</button>
        </div>

        {/* Current role reveal */}
        {challenge.status === 'active' && currentRound > 0 && myRole && (
          <div className={`rounded-xl p-6 mb-6 text-center border ${myRole === 'scientist'
              ? 'bg-purple-900/30 border-purple-500/40'
              : 'bg-candle-600/10 border-candle-500/30'
            }`}>
            <div className="text-4xl mb-3">{myRole === 'scientist' ? '🧪' : '🏃'}</div>
            <p className={`font-cinzel text-xl font-bold tracking-wider ${myRole === 'scientist' ? 'text-purple-300' : 'text-candle-400'
              }`}>
              {myRole === 'scientist' ? 'Savant Fou' : 'Citoyen'}
            </p>
            <p className="font-crimson text-moon-400 text-sm mt-2 italic">
              {myRole === 'scientist'
                ? 'Attrape les citoyens avec ta pipette à eau !'
                : 'Trouve les objets cachés et échappe aux savants fous !'}
            </p>
          </div>
        )}

        {challenge.status === 'active' && currentRound > 0 && !myRole && (
          <div className="bg-night-800/30 border border-night-700/30 border-dashed rounded-xl p-4 mb-6 text-center">
            <p className="font-crimson text-moon-400/50 text-sm italic animate-pulse">
              ⏳ En attente de l'attribution des rôles...
            </p>
          </div>
        )}

        {challenge.status === 'active' && currentRound === 0 && (
          <div className="bg-night-800/30 border border-night-700/30 border-dashed rounded-xl p-4 mb-6 text-center">
            <p className="font-crimson text-moon-400/50 text-sm italic">
              ⏳ En attente du début de la première manche...
            </p>
          </div>
        )}

        {/* My score */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm text-center">
          <p className="font-crimson text-moon-400 text-sm">Ton score total</p>
          <p className="font-cinzel text-3xl font-bold text-candle-400">
            {playerScoreMap.get(player.id) ?? 0}
          </p>
        </div>

        {/* Leaderboard */}
        <Leaderboard
          scores={leaderboardScores}
          title="Classement"
          currentPlayerId={player.id}
        />
      </div>
    </div>
  )
}
