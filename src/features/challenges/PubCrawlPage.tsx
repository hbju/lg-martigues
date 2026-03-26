import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useChallengeStore } from '../../stores/challengeStore'

interface BarStop {
  bar: string
  order: number
  meets_team: string
  address: string
  completed?: boolean
}

export function PubCrawlPage() {
  const { player } = useAuthStore()
  const { challenges, teams, teamMembers, scores, subscribeToAll, subscribeToChallenge } = useChallengeStore()
  const navigate = useNavigate()

  const challenge = challenges.find(c => c.type === 'pub_crawl')

  useEffect(() => {
    const unsub = subscribeToAll()
    return unsub
  }, [])

  useEffect(() => {
    if (!challenge) return
    const unsub = subscribeToChallenge(challenge.id)
    return unsub
  }, [challenge?.id])

  // Find my team
  const myMembership = teamMembers.find(
    tm => tm.player_id === player?.id && teams.some(t => t.id === tm.team_id && t.challenge_id === challenge?.id)
  )
  const myTeam = myMembership ? teams.find(t => t.id === myMembership.team_id) : null

  // Get team's route
  const route: BarStop[] = myTeam?.metadata
    ? ((myTeam.metadata as Record<string, unknown>).route as BarStop[] ?? [])
    : []

  const finalDestination = myTeam?.metadata
    ? (myTeam.metadata as Record<string, unknown>).final_destination as string | null
    : null

  // Count clues earned
  const teamScores = scores.filter(s => s.team_id === myTeam?.id)
  const clueCount = teamScores.reduce((sum, s) => sum + s.score, 0)
  const clueThreshold = (challenge?.metadata as Record<string, unknown>)?.clue_threshold as number ?? 2

  // Check if destination is revealed
  const destinationRevealed = finalDestination || clueCount >= clueThreshold

  function getTeamName(teamId: string): string {
    const team = teams.find(t => t.id === teamId)
    return team?.name ?? teamId
  }

  if (!player) return null

  if (!challenge) {
    return (
      <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">🍻</div>
        <p className="font-cinzel text-parchment-100 text-xl mb-2">Pub Crawl</p>
        <p className="font-crimson text-moon-400 italic">Le pub crawl n'a pas encore été créé par le MJ.</p>
        <button onClick={() => navigate('/home')} className="mt-4 text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Retour</button>
      </div>
    )
  }

  if (!myTeam) {
    return (
      <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">🍻</div>
        <p className="font-cinzel text-parchment-100 text-xl mb-2">Pub Crawl</p>
        <p className="font-crimson text-moon-400 italic">Tu n'as pas encore été assigné à une équipe. Le MJ s'en occupe !</p>
        <button onClick={() => navigate('/home')} className="mt-4 text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Retour</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">🍻 Pub Crawl</h1>
            <p className="font-crimson text-candle-400 text-sm">Équipe : {myTeam.name}</p>
          </div>
          <button onClick={() => navigate('/home')} className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Retour</button>
        </div>

        {/* Clue progress */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="font-cinzel text-parchment-100 text-sm font-semibold">Indices trouvés</p>
            <p className="font-cinzel text-candle-400">{clueCount} / {clueThreshold}</p>
          </div>
          <div className="w-full bg-night-800 rounded-full h-2">
            <div
              className="bg-candle-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (clueCount / clueThreshold) * 100)}%` }}
            />
          </div>
        </div>

        {/* Route */}
        <div className="mb-6">
          <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
            Ton itinéraire
          </h2>
          <div className="space-y-3">
            {route.sort((a, b) => a.order - b.order).map((stop, idx) => {
              const isCompleted = stop.completed
              const isCurrent = !isCompleted && (idx === 0 || route[idx - 1]?.completed)
              return (
                <div
                  key={idx}
                  className={`rounded-xl p-4 border transition-colors ${isCurrent ? 'bg-candle-600/20 border-candle-500/30' :
                    isCompleted ? 'bg-night-800/30 border-night-700/20 opacity-60' :
                      'bg-parchment-card border-night-700/20'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-cinzel font-bold text-sm ${isCurrent ? 'bg-candle-500 text-night-950' :
                      isCompleted ? 'bg-night-600 text-night-800' :
                        'bg-night-700 text-moon-400'
                      }`}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`font-cinzel font-semibold text-sm ${isCurrent ? 'text-candle-400' : 'text-parchment-200'}`}>
                        {stop.bar}
                      </p>
                      {stop.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-crimson text-moon-400/60 text-xs underline hover:text-candle-400"
                        >
                          📍 {stop.address}
                        </a>
                      )}
                      {stop.meets_team && (
                        <p className="font-crimson text-moon-400 text-xs mt-1">
                          🤝 Rencontre : <strong>{getTeamName(stop.meets_team)}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Final destination */}
        {destinationRevealed ? (
          <div className="bg-candle-600/20 border border-candle-500/40 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <p className="font-cinzel text-candle-400 font-bold text-lg mb-1">Destination finale débloquée !</p>
            <p className="font-crimson text-parchment-200">
              {finalDestination ?? (challenge.metadata as Record<string, unknown>)?.final_destination_name as string ?? 'Rendez-vous communiqué par le MJ'}
            </p>
          </div>
        ) : (
          <div className="bg-night-800/30 border border-night-700/30 border-dashed rounded-xl p-4 text-center">
            <div className="text-2xl mb-2 opacity-40">❓</div>
            <p className="font-crimson text-moon-400/50 text-sm italic">
              Gagne des challenges pour débloquer la destination finale.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
