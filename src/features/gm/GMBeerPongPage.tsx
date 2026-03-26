import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
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

export function GMBeerPongPage() {
  const { challenges, teams, teamMembers, subscribeToAll, subscribeToChallenge } = useChallengeStore()
  const { players } = useRealtimePlayers()
  const [isCreating, setIsCreating] = useState(false)

  const challenge = challenges.find(c => c.type === 'beer_pong')

  useEffect(() => {
    const unsub = subscribeToAll()
    return unsub
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

  const challengeTeams = teams.filter(t => t.challenge_id === challenge?.id)
  const bracket: BracketRound[] = challenge?.metadata
    ? ((challenge.metadata as Record<string, unknown>).rounds as BracketRound[] ?? [])
    : []

  async function handleCreateChallenge() {
    setIsCreating(true)
    await supabase.from('challenges').insert({
      name: 'Tournoi Beer Pong',
      type: 'beer_pong' as const,
      status: 'upcoming' as const,
    })
    setIsCreating(false)
  }

  async function handleGenerateBracket() {
    if (!challenge) return
    if (!confirm('Générer le bracket ? Cela lancera le tournoi.')) return

    // Shuffle teams
    const shuffled = [...challengeTeams]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Generate bracket
    const rounds: BracketRound[] = []

    // First round
    const firstRoundMatches: BracketMatch[] = []
    let matchId = 1

    // Handle bye (odd number of teams)
    const byes: string[] = []
    let teamsForRound = [...shuffled]
    if (teamsForRound.length % 2 !== 0) {
      const byeTeam = teamsForRound.pop()!
      byes.push(byeTeam.id)
    }

    for (let i = 0; i < teamsForRound.length; i += 2) {
      firstRoundMatches.push({
        id: `m${matchId++}`,
        team_a: teamsForRound[i].id,
        team_b: teamsForRound[i + 1]?.id ?? null,
        winner: null,
      })
    }
    rounds.push({ round: 1, matches: firstRoundMatches })

    // Calculate number of subsequent rounds
    let winnersCount = firstRoundMatches.length + byes.length
    let roundNum = 2
    while (winnersCount > 1) {
      const matches: BracketMatch[] = []
      // For the second round, first slot might be the bye team
      const slotsNeeded = Math.ceil(winnersCount / 2)
      for (let i = 0; i < slotsNeeded; i++) {
        matches.push({
          id: `m${matchId++}`,
          team_a: roundNum === 2 && i === 0 && byes.length > 0 ? byes[0] : null,
          team_b: null,
          winner: null,
        })
      }
      rounds.push({ round: roundNum, matches })
      winnersCount = slotsNeeded
      roundNum++
    }

    await supabase
      .from('challenges')
      .update({
        status: 'active' as const,
        metadata: { rounds },
        updated_at: new Date().toISOString(),
      })
      .eq('id', challenge.id)
  }

  async function handleSetWinner(roundIdx: number, matchIdx: number, winnerId: string) {
    if (!challenge) return

    const updatedRounds = JSON.parse(JSON.stringify(bracket)) as BracketRound[]
    updatedRounds[roundIdx].matches[matchIdx].winner = winnerId

    // Advance winner to next round
    if (roundIdx + 1 < updatedRounds.length) {
      const nextRound = updatedRounds[roundIdx + 1]
      // Find the next available slot
      for (const match of nextRound.matches) {
        if (!match.team_a) {
          match.team_a = winnerId
          break
        } else if (!match.team_b) {
          match.team_b = winnerId
          break
        }
      }
    }

    // Check if tournament is done (final match has a winner)
    const lastRound = updatedRounds[updatedRounds.length - 1]
    const finalMatch = lastRound.matches[0]
    const isTournamentDone = finalMatch?.winner !== null && finalMatch?.winner !== undefined

    await supabase
      .from('challenges')
      .update({
        status: isTournamentDone ? 'completed' as const : 'active' as const,
        metadata: { rounds: updatedRounds },
        updated_at: new Date().toISOString(),
      })
      .eq('id', challenge.id)

    // If tournament is done, grant shields to winners
    if (isTournamentDone && finalMatch.winner) {
      const winnerMembers = teamMembers.filter(tm => tm.team_id === finalMatch.winner)
      for (const member of winnerMembers) {
        await supabase.from('power_ups').insert({
          player_id: member.player_id,
          type: 'shield' as const,
          source: 'challenge' as const,
          granted_by_gm: true,
        })
        await supabase.from('notifications').insert({
          player_id: member.player_id,
          type: 'shield_gained' as const,
          title: '🏆 Beer Pong — Victoire !',
          message: 'Tu as gagné le tournoi ! Tu reçois un bouclier d\'immunité pour le premier conseil.',
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">🍺 Beer Pong (MJ)</h1>
          <Link to="/gm/challenges" className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Challenges</Link>
        </div>

        {!challenge && (
          <button
            onClick={handleCreateChallenge}
            disabled={isCreating}
            className="w-full bg-gradient-to-b from-candle-500 to-candle-600 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all mb-6"
          >
            Créer le tournoi Beer Pong
          </button>
        )}

        {challenge?.status === 'upcoming' && (
          <>
            <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
              <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
                Équipes inscrites ({challengeTeams.length})
              </h2>
              <div className="space-y-2">
                {challengeTeams.map(t => (
                  <div key={t.id} className="p-2.5 bg-night-800/50 border border-night-700/30 rounded-lg">
                    <p className="font-crimson text-parchment-200 text-sm">{t.name}</p>
                  </div>
                ))}
                {challengeTeams.length === 0 && (
                  <p className="font-crimson text-moon-400/50 italic text-sm">Aucune équipe inscrite.</p>
                )}
              </div>
            </div>
            {challengeTeams.length >= 2 && (
              <button
                onClick={handleGenerateBracket}
                className="w-full bg-gradient-to-b from-candle-500 to-candle-600 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all"
              >
                🎲 Générer le bracket et lancer le tournoi
              </button>
            )}
          </>
        )}

        {(challenge?.status === 'active' || challenge?.status === 'completed') && bracket.length > 0 && (
          <div className="space-y-6">
            {bracket.map((round, roundIdx) => (
              <div key={round.round}>
                <h2 className="font-cinzel text-candle-400 font-semibold text-sm tracking-wider uppercase mb-3">
                  {round.round === bracket.length ? '🏆 Finale' : `Tour ${round.round}`}
                </h2>
                <div className="space-y-3">
                  {round.matches.map((match, matchIdx) => (
                    <div key={match.id} className="bg-parchment-card rounded-xl p-4 backdrop-blur-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <p className={`font-crimson text-sm ${match.winner === match.team_a ? 'text-candle-400 font-bold' : 'text-parchment-200'}`}>
                            {match.team_a ? getTeamName(match.team_a) : '—'}
                          </p>
                          <p className="text-moon-400/30 text-xs font-cinzel">VS</p>
                          <p className={`font-crimson text-sm ${match.winner === match.team_b ? 'text-candle-400 font-bold' : 'text-parchment-200'}`}>
                            {match.team_b ? getTeamName(match.team_b) : '—'}
                          </p>
                        </div>

                        {!match.winner && match.team_a && match.team_b && (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleSetWinner(roundIdx, matchIdx, match.team_a!)}
                              className="bg-candle-500/20 border border-candle-500/30 text-candle-400 px-3 py-1 rounded text-xs font-cinzel hover:bg-candle-500/30 transition-colors"
                            >
                              A gagne
                            </button>
                            <button
                              onClick={() => handleSetWinner(roundIdx, matchIdx, match.team_b!)}
                              className="bg-candle-500/20 border border-candle-500/30 text-candle-400 px-3 py-1 rounded text-xs font-cinzel hover:bg-candle-500/30 transition-colors"
                            >
                              B gagne
                            </button>
                          </div>
                        )}

                        {match.winner && (
                          <span className="text-candle-400 font-cinzel text-xs">✅</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
