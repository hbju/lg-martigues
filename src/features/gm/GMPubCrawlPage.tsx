import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useChallengeStore } from '../../stores/challengeStore'

export function GMPubCrawlPage() {
  const { challenges, teams, teamMembers, scores, subscribeToAll, subscribeToChallenge } = useChallengeStore()
  const [isCreating, setIsCreating] = useState(false)
  const [clueThreshold, setClueThreshold] = useState(2)
  const [finalDestName, setFinalDestName] = useState('')

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

  const challengeTeams = teams.filter(t => t.challenge_id === challenge?.id)

  async function handleCreateChallenge() {
    setIsCreating(true)
    await supabase.from('challenges').insert({
      name: 'Pub Crawl',
      type: 'pub_crawl' as const,
      status: 'upcoming' as const,
      metadata: {
        clue_threshold: clueThreshold,
        final_destination_name: finalDestName || 'À définir',
      },
    })
    setIsCreating(false)
  }

  async function handleStartChallenge() {
    if (!challenge) return
    await supabase
      .from('challenges')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', challenge.id)
  }

  async function handleLogWin(teamId: string, barName: string) {
    if (!challenge) return
    // Add a clue score for the team
    await supabase.from('challenge_scores').insert({
      challenge_id: challenge.id,
      team_id: teamId,
      score: 1,
      metadata: { bar: barName, type: 'challenge_win' },
    })
  }

  async function handleRevealDestination(teamId: string) {
    if (!challenge) return
    const team = teams.find(t => t.id === teamId)
    if (!team) return

    const meta = (team.metadata ?? {}) as Record<string, unknown>
    await supabase
      .from('teams')
      .update({
        metadata: {
          ...meta,
          final_destination: (challenge.metadata as Record<string, unknown>)?.final_destination_name ?? 'Destination finale',
        },
      })
      .eq('id', teamId)

    // Notify team members
    const members = teamMembers.filter(tm => tm.team_id === teamId)
    for (const m of members) {
      await supabase.from('notifications').insert({
        player_id: m.player_id,
        type: 'challenge_update' as const,
        title: '🎯 Destination révélée !',
        message: 'La destination finale du pub crawl a été débloquée. Regarde ton itinéraire !',
      })
    }
  }

  async function handleMarkArrival(teamId: string, order: number) {
    if (!challenge) return
    await supabase.from('challenge_scores').insert({
      challenge_id: challenge.id,
      team_id: teamId,
      score: 0,
      metadata: { type: 'arrival', arrival_order: order },
    })
  }

  async function handleGrantShieldsToFirst(teamId: string) {
    const members = teamMembers.filter(tm => tm.team_id === teamId)
    for (const m of members) {
      await supabase.from('power_ups').insert({
        player_id: m.player_id,
        type: 'shield' as const,
        source: 'challenge' as const,
        granted_by_gm: true,
      })
      await supabase.from('notifications').insert({
        player_id: m.player_id,
        type: 'shield_gained' as const,
        title: '🛡️ Bouclier gagné !',
        message: 'Votre équipe est arrivée en premier au pub crawl ! Vous recevez un bouclier.',
      })
    }
  }

  async function handleTogglePenalty(teamId: string) {
    const team = teams.find(t => t.id === teamId)
    if (!team) return
    const meta = (team.metadata ?? {}) as Record<string, unknown>
    await supabase
      .from('teams')
      .update({ metadata: { ...meta, penalty: !meta.penalty } })
      .eq('id', teamId)
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
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">🍻 Pub Crawl (MJ)</h1>
          <Link to="/gm/challenges" className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Challenges</Link>
        </div>

        {!challenge && (
          <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
            <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
              Configurer le Pub Crawl
            </h2>
            <div className="space-y-3">
              <div>
                <label className="font-crimson text-moon-400 text-xs block mb-1">Seuil d'indices</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={clueThreshold}
                  onChange={e => setClueThreshold(Number(e.target.value))}
                  className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson"
                />
              </div>
              <div>
                <label className="font-crimson text-moon-400 text-xs block mb-1">Destination finale</label>
                <input
                  type="text"
                  value={finalDestName}
                  onChange={e => setFinalDestName(e.target.value)}
                  placeholder="Ex: Le Trolleybus, Cours Mirabeau"
                  className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson placeholder:text-night-600"
                />
              </div>
              <button
                onClick={handleCreateChallenge}
                disabled={isCreating}
                className="w-full bg-gradient-to-b from-candle-500 to-candle-600 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all"
              >
                Créer le Pub Crawl
              </button>
            </div>
          </div>
        )}

        {challenge?.status === 'upcoming' && (
          <div className="space-y-4">
            <p className="font-crimson text-moon-400 italic text-sm">
              Crée les équipes et assigne les routes depuis Supabase ou manuellement. Puis lance le challenge.
            </p>
            <button
              onClick={handleStartChallenge}
              disabled={challengeTeams.length < 2}
              className="w-full bg-gradient-to-b from-candle-500 to-candle-600 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all disabled:opacity-40"
            >
              ▶️ Lancer le Pub Crawl
            </button>
          </div>
        )}

        {challenge && (challenge.status === 'active' || challenge.status === 'completed') && (
          <div className="space-y-4">
            {challengeTeams.map(team => {
              const teamScoresList = scores.filter(s => s.team_id === team.id)
              const clues = teamScoresList.filter(s => (s.metadata as Record<string, unknown>)?.type === 'challenge_win').length
              const meta = (team.metadata ?? {}) as Record<string, unknown>
              const hasPenalty = meta.penalty === true

              return (
                <div key={team.id} className={`bg-parchment-card rounded-xl p-4 backdrop-blur-sm ${hasPenalty ? 'border-2 border-red-500/40' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-cinzel text-parchment-100 font-semibold text-sm">{team.name}</p>
                      <p className="font-crimson text-moon-400/60 text-xs">Indices : {clues} / {clueThreshold} {hasPenalty && '⚠️ Pénalité'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleLogWin(team.id, 'Challenge')}
                      className="bg-candle-500/20 border border-candle-500/30 text-candle-400 px-3 py-1.5 rounded-lg text-xs font-crimson hover:bg-candle-500/30 transition-colors"
                    >
                      +1 Indice
                    </button>
                    <button
                      onClick={() => handleRevealDestination(team.id)}
                      className="bg-purple-600/20 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-crimson hover:bg-purple-600/30 transition-colors"
                    >
                      Révéler destination
                    </button>
                    <button
                      onClick={() => handleMarkArrival(team.id, challengeTeams.indexOf(team) + 1)}
                      className="bg-night-700 border border-night-600 text-moon-400 px-3 py-1.5 rounded-lg text-xs font-crimson hover:bg-night-600 transition-colors"
                    >
                      Arrivée
                    </button>
                    <button
                      onClick={() => handleGrantShieldsToFirst(team.id)}
                      className="bg-candle-600/20 border border-candle-500/30 text-candle-400 px-3 py-1.5 rounded-lg text-xs font-crimson hover:bg-candle-500/30 transition-colors"
                    >
                      🛡️ Shields
                    </button>
                    <button
                      onClick={() => handleTogglePenalty(team.id)}
                      className={`border px-3 py-1.5 rounded-lg text-xs font-crimson transition-colors ${hasPenalty
                        ? 'bg-red-600/20 border-red-500/30 text-red-400'
                        : 'bg-night-700 border-night-600 text-moon-400 hover:bg-night-600'
                        }`}
                    >
                      {hasPenalty ? '❌ Retirer pénalité' : '⚠️ Pénalité'}
                    </button>
                  </div>
                </div>
              )
            })}

            {challenge.status === 'active' && (
              <button
                onClick={handleEndChallenge}
                className="w-full bg-night-700 border border-night-600 text-moon-400 py-2 rounded-lg font-crimson hover:bg-night-600 transition-colors mt-4"
              >
                Terminer le Pub Crawl
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
