import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useChallengeStore } from '../../stores/challengeStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'

interface BracketMatch {
  id: string
  team_a: string | null
  team_b: string | null
  winner: string | null
}

interface BracketRound {
  round: number
  matches: BracketMatch[]
}

export function BeerPongPage() {
  const { player } = useAuthStore()
  const { challenges, teams, teamMembers, subscribeToAll, subscribeToChallenge } = useChallengeStore()
  const { players } = useRealtimePlayers()
  const navigate = useNavigate()
  const [selectedPartner, setSelectedPartner] = useState<string>('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const challenge = challenges.find(c => c.type === 'beer_pong')

  useEffect(() => {
    const unsub1 = subscribeToAll()
    return unsub1
  }, [])

  useEffect(() => {
    if (!challenge) return
    const unsub = subscribeToChallenge(challenge.id)
    return unsub
  }, [challenge?.id])

  function getPlayerName(id: string): string {
    return players.find(p => p.id === id)?.name ?? 'Inconnu'
  }

  function getTeamName(teamId: string): string {
    const team = teams.find(t => t.id === teamId)
    if (!team) return teamId
    const members = teamMembers.filter(tm => tm.team_id === teamId)
    return members.map(m => getPlayerName(m.player_id)).join(' & ')
  }

  // Find the current player's team
  const myTeamMembership = teamMembers.find(
    tm => tm.player_id === player?.id && teams.find(t => t.id === tm.team_id && t.challenge_id === challenge?.id)
  )
  const myTeam = myTeamMembership ? teams.find(t => t.id === myTeamMembership.team_id) : null

  // Players available for pairing (not already in a team for this challenge)
  const registeredPlayerIds = new Set(
    teamMembers
      .filter(tm => teams.some(t => t.id === tm.team_id && t.challenge_id === challenge?.id))
      .map(tm => tm.player_id)
  )
  const availablePlayers = players.filter(
    p => !p.is_gm && p.id !== player?.id && !registeredPlayerIds.has(p.id) && p.status === 'alive'
  )

  const bracket: BracketRound[] = challenge?.metadata
    ? ((challenge.metadata as Record<string, unknown>).rounds as BracketRound[] ?? [])
    : []

  async function handleRegister() {
    if (!selectedPartner || !player || !challenge) return
    setIsRegistering(true)

    const teamId = `bp-${crypto.randomUUID().slice(0, 8)}`
    const partnerName = getPlayerName(selectedPartner)

    await supabase.from('teams').insert({
      id: teamId,
      name: `${player.name} & ${partnerName}`,
      challenge_id: challenge.id,
    })

    await supabase.from('team_members').insert([
      { team_id: teamId, player_id: player.id },
      { team_id: teamId, player_id: selectedPartner },
    ])

    // Notify partner
    await supabase.from('notifications').insert({
      player_id: selectedPartner,
      type: 'challenge_update' as const,
      title: 'Beer Pong 🍺',
      message: `${player.name} t'a inscrit(e) au tournoi de Beer Pong !`,
    })

    setMessage(`Équipe formée avec ${partnerName} !`)
    setSelectedPartner('')
    setIsRegistering(false)
  }

  if (!player) return null

  if (!challenge) {
    return (
      <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">🍺</div>
        <p className="font-cinzel text-parchment-100 text-xl mb-2">Beer Pong</p>
        <p className="font-crimson text-moon-400 italic">Le tournoi n'a pas encore été créé par le MJ.</p>
        <button onClick={() => navigate('/home')} className="mt-4 text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Retour</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">🍺 Beer Pong</h1>
            <p className="font-crimson text-moon-400 text-sm italic">
              {challenge.status === 'upcoming' ? 'Inscriptions ouvertes' :
                challenge.status === 'active' ? 'Tournoi en cours' : 'Terminé'}
            </p>
          </div>
          <button onClick={() => navigate('/home')} className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Retour</button>
        </div>

        {message && (
          <div className="bg-candle-600/20 border border-candle-500/30 rounded-xl p-4 mb-6">
            <p className="font-crimson text-candle-400 text-sm">{message}</p>
          </div>
        )}

        {/* Registration (upcoming) */}
        {challenge.status === 'upcoming' && !myTeam && (
          <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
            <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
              Trouve un partenaire
            </h2>
            <select
              value={selectedPartner}
              onChange={e => setSelectedPartner(e.target.value)}
              className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson mb-3"
            >
              <option value="">Choisir un partenaire...</option>
              {availablePlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleRegister}
              disabled={!selectedPartner || isRegistering}
              className="w-full bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all disabled:opacity-40"
            >
              {isRegistering ? 'Inscription...' : "S'inscrire en duo"}
            </button>
          </div>
        )}

        {/* Already registered */}
        {myTeam && challenge.status === 'upcoming' && (
          <div className="bg-candle-600/20 border border-candle-500/30 rounded-xl p-4 mb-6">
            <p className="font-cinzel text-candle-400 text-sm font-semibold">✅ Inscrit !</p>
            <p className="font-crimson text-moon-400 text-sm mt-1">
              Équipe : <strong className="text-parchment-200">{myTeam.name}</strong>
            </p>
            <p className="font-crimson text-moon-400/60 text-xs mt-1 italic">En attente du lancement du tournoi...</p>
          </div>
        )}

        {/* Registered teams list */}
        {challenge.status === 'upcoming' && teams.filter(t => t.challenge_id === challenge.id).length > 0 && (
          <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
            <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
              Équipes inscrites ({teams.filter(t => t.challenge_id === challenge.id).length})
            </h2>
            <div className="space-y-2">
              {teams.filter(t => t.challenge_id === challenge.id).map(t => (
                <div key={t.id} className={`p-2.5 bg-night-800/50 border rounded-lg ${t.id === myTeam?.id ? 'border-candle-500/30' : 'border-night-700/30'}`}>
                  <p className="font-crimson text-parchment-200 text-sm">{t.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bracket view */}
        {(challenge.status === 'active' || challenge.status === 'completed') && bracket.length > 0 && (
          <div className="space-y-6">
            {bracket.map((round) => (
              <div key={round.round}>
                <h2 className="font-cinzel text-candle-400 font-semibold text-sm tracking-wider uppercase mb-3">
                  {round.round === bracket.length ? '🏆 Finale' : `Tour ${round.round}`}
                </h2>
                <div className="space-y-3">
                  {round.matches.map((match) => {
                    const isMyMatch = myTeam && (match.team_a === myTeam.id || match.team_b === myTeam.id)
                    return (
                      <div
                        key={match.id}
                        className={`bg-parchment-card rounded-xl p-4 backdrop-blur-sm border ${isMyMatch ? 'border-candle-500/40' : 'border-night-700/20'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className={`font-crimson text-sm ${match.winner === match.team_a ? 'text-candle-400 font-bold' : 'text-parchment-200'}`}>
                              {match.team_a ? getTeamName(match.team_a) : 'TBD'}
                              {match.winner === match.team_a && ' 🏆'}
                            </p>
                            <div className="h-px bg-night-700/30 my-2" />
                            <p className={`font-crimson text-sm ${match.winner === match.team_b ? 'text-candle-400 font-bold' : 'text-parchment-200'}`}>
                              {match.team_b ? getTeamName(match.team_b) : 'TBD'}
                              {match.winner === match.team_b && ' 🏆'}
                            </p>
                          </div>
                          <div className="text-center ml-4">
                            {match.winner ? (
                              <span className="text-candle-400 text-xs font-cinzel">Terminé</span>
                            ) : match.team_a && match.team_b ? (
                              <span className="text-moon-400/60 text-xs font-crimson italic">En cours</span>
                            ) : (
                              <span className="text-moon-400/40 text-xs font-crimson italic">À venir</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {challenge.status === 'completed' && (
          <div className="bg-candle-600/20 border border-candle-500/30 rounded-xl p-4 mt-6 text-center">
            <div className="text-4xl mb-2">🏆</div>
            <p className="font-cinzel text-candle-400 font-bold text-lg">Tournoi terminé !</p>
          </div>
        )}
      </div>
    </div>
  )
}
