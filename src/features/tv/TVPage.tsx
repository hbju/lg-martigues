import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { GameState, VoteRound, Vote, Player } from '../../types/supabase'

type TVScene = 'idle' | 'vote_countdown' | 'vote_results' | 'murder' | 'leaderboard' | 'custom_message' | 'final_reveal'

interface TVState {
  scene: TVScene
  data?: Record<string, unknown>
}

export function TVPage() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [tvState, setTvState] = useState<TVState>({ scene: 'idle' })
  const [players, setPlayers] = useState<Player[]>([])
  const [currentRound, setCurrentRound] = useState<VoteRound | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [alivePlayers, setAlivePlayers] = useState<Player[]>([])
  const [revealedRoles, setRevealedRoles] = useState<Map<string, string>>(new Map())
  const [revealIndex, setRevealIndex] = useState(0)

  // Fetch initial data
  useEffect(() => {
    fetchAll()

    const ch1 = supabase
      .channel('tv_game_state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' }, (payload) => {
        const gs = payload.new as GameState
        setGameState(gs)
        handleGameStateChange(gs)
      })
      .subscribe()

    const ch2 = supabase
      .channel('tv_vote_rounds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_rounds' }, () => {
        fetchCurrentRound()
      })
      .subscribe()

    const ch3 = supabase
      .channel('tv_votes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, () => {
        fetchVotes()
      })
      .subscribe()

    const ch4 = supabase
      .channel('tv_eliminations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eliminations' }, () => {
        fetchPlayers()
      })
      .subscribe()

    const ch5 = supabase
      .channel('tv_players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
      supabase.removeChannel(ch3)
      supabase.removeChannel(ch4)
      supabase.removeChannel(ch5)
    }
  }, [])

  // Handle vote round changes
  useEffect(() => {
    if (!currentRound) return

    if (currentRound.status === 'open' && currentRound.type === 'council') {
      setTvState({ scene: 'vote_countdown' })
    } else if (currentRound.status === 'resolved') {
      if (currentRound.type === 'council' || currentRound.type === 'final') {
        fetchVotes()
        // Show results after a dramatic pause
        setTimeout(() => {
          setTvState({ scene: 'vote_results', data: { round_id: currentRound.id } })
        }, 2500)
        // Return to idle after 30s
        setTimeout(() => {
          setTvState({ scene: 'idle' })
        }, 32500)
      }
    }
  }, [currentRound?.status, currentRound?.id])

  async function fetchAll() {
    const [gsRes, pRes] = await Promise.all([
      supabase.from('game_state').select('*').eq('id', 1).single(),
      supabase.from('players').select('*').eq('is_gm', false).order('name'),
    ])
    if (gsRes.data) {
      setGameState(gsRes.data as GameState)
      handleGameStateChange(gsRes.data as GameState)
    }
    if (pRes.data) {
      setPlayers(pRes.data as Player[])
      setAlivePlayers((pRes.data as Player[]).filter(p => p.status === 'alive'))
    }
    fetchCurrentRound()
  }

  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('*').eq('is_gm', false).order('name')
    if (data) {
      setPlayers(data as Player[])
      setAlivePlayers((data as Player[]).filter(p => p.status === 'alive'))
    }
  }

  async function fetchCurrentRound() {
    const { data } = await supabase
      .from('vote_rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.[0]) {
      setCurrentRound(data[0] as VoteRound)
      if (data[0].status === 'open' || data[0].status === 'resolved') {
        fetchVotesForRound(data[0].id)
      }
    }
  }

  async function fetchVotes() {
    if (!currentRound) return
    fetchVotesForRound(currentRound.id)
  }

  async function fetchVotesForRound(roundId: string) {
    const { data } = await supabase.from('votes').select('*').eq('round_id', roundId)
    if (data) setVotes(data as Vote[])
  }

  function handleGameStateChange(gs: GameState) {
    const meta = (gs.metadata ?? {}) as Record<string, unknown>
    const tvControl = meta.tv_state as TVState | undefined

    if (tvControl) {
      setTvState(tvControl)

      // Handle final reveal animation
      if (tvControl.scene === 'final_reveal') {
        startFinalReveal()
      }
    }
  }

  function startFinalReveal() {
    setRevealIndex(0)
    setRevealedRoles(new Map())
    const aliveP = players.filter(p => p.status === 'alive' || p.status === 'ghost')
    let idx = 0
    const interval = setInterval(() => {
      if (idx >= aliveP.length) {
        clearInterval(interval)
        return
      }
      setRevealedRoles(prev => new Map(prev).set(aliveP[idx].id, aliveP[idx].role ?? 'villager'))
      setRevealIndex(idx + 1)
      idx++
    }, 3000)
  }

  function getPlayerName(id: string): string {
    return players.find(p => p.id === id)?.name ?? 'Inconnu'
  }

  // Request fullscreen on click
  function handleGoFullscreen() {
    document.documentElement.requestFullscreen?.()
  }

  const aliveCount = alivePlayers.length

  const phaseLabels: Record<string, string> = {
    setup: 'Préparation',
    role_reveal: 'Révélation',
    playing: 'En cours',
    final_vote: 'Vote final',
    finished: 'Terminé',
  }

  // ─── SCENES ───

  // IDLE
  if (tvState.scene === 'idle') {
    return (
      <div
        onClick={handleGoFullscreen}
        className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-12 relative overflow-hidden cursor-pointer"
      >
        {/* Ambient stars */}
        <div className="absolute inset-0">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute bg-parchment-200 rounded-full"
              style={{
                width: `${1 + Math.random() * 2}px`,
                height: `${1 + Math.random() * 2}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: 0.2 + Math.random() * 0.4,
                animation: `twinkle ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 3}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Moon */}
        <div className="absolute top-12 right-24 w-32 h-32 rounded-full bg-gradient-to-br from-moon-200 to-moon-300 opacity-10 moon-glow" />

        <div className="text-center relative z-10">
          <div className="text-8xl mb-8 animate-slow-pulse">🐺</div>
          <h1 className="font-cinzel text-5xl font-bold text-parchment-100 tracking-[0.3em] mb-4">
            LES LOUPS-GAROUS
          </h1>
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="h-px w-24 bg-gradient-to-r from-transparent to-candle-400/50" />
            <p className="font-crimson text-candle-400 italic text-2xl">de Martigues</p>
            <div className="h-px w-24 bg-gradient-to-l from-transparent to-candle-400/50" />
          </div>
          <div className="mt-12 flex items-center gap-8 justify-center">
            <div className="text-center">
              <p className="font-cinzel text-4xl font-bold text-candle-400">{aliveCount}</p>
              <p className="font-crimson text-moon-400 text-lg">survivants</p>
            </div>
            {gameState && (
              <div className="text-center">
                <p className="font-cinzel text-lg text-moon-400/60">{phaseLabels[gameState.phase] ?? ''}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // VOTE COUNTDOWN
  if (tvState.scene === 'vote_countdown' && currentRound) {
    const endTime = currentRound.timer_end_at ? new Date(currentRound.timer_end_at) : null
    const totalVoters = alivePlayers.length
    const votedCount = votes.length

    return (
      <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-blood-900/20 via-transparent to-transparent" />
        <div className="text-center relative z-10">
          <h1 className="font-cinzel text-4xl font-bold text-parchment-100 tracking-[0.2em] mb-8">
            ⚖️ LE CONSEIL A LIEU
          </h1>

          {endTime && <TVCountdown endTime={endTime} />}

          <div className="mt-12">
            <p className="font-crimson text-moon-400 text-2xl">
              <span className="text-candle-400 font-bold font-cinzel text-3xl">{votedCount}</span>
              {' '}/{' '}
              <span className="font-cinzel text-2xl">{totalVoters}</span>
              {' '}votes
            </p>
            <div className="w-64 mx-auto mt-4 bg-night-800 rounded-full h-3">
              <div
                className="bg-candle-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${totalVoters > 0 ? (votedCount / totalVoters) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // VOTE RESULTS
  if (tvState.scene === 'vote_results') {
    // Tally votes
    const tally = new Map<string, string[]>()
    votes.forEach(v => {
      const voters = tally.get(v.target_id) ?? []
      voters.push(v.voter_id)
      tally.set(v.target_id, voters)
    })

    const sortedTargets = Array.from(tally.entries())
      .sort((a, b) => b[1].length - a[1].length)

    const eliminatedId = sortedTargets[0]?.[0]

    return (
      <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-blood-900/30 via-transparent to-transparent" />
        <div className="text-center relative z-10 w-full max-w-2xl">
          <h1 className="font-cinzel text-3xl font-bold text-parchment-100 tracking-[0.2em] mb-8">
            📊 RÉSULTATS DU CONSEIL
          </h1>

          <div className="space-y-4 mb-8">
            {sortedTargets.map(([targetId, voterIds]) => {
              const isEliminated = targetId === eliminatedId
              return (
                <div
                  key={targetId}
                  className={`rounded-xl p-4 flex items-center justify-between ${isEliminated
                      ? 'bg-blood-800/40 border-2 border-red-500/60'
                      : 'bg-night-800/50 border border-night-700/30'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`font-cinzel text-3xl font-bold ${isEliminated ? 'text-red-400' : 'text-candle-400'}`}>
                      {voterIds.length}
                    </span>
                    <div>
                      <p className={`font-cinzel text-lg font-semibold ${isEliminated ? 'text-red-300' : 'text-parchment-200'}`}>
                        {getPlayerName(targetId)}
                        {isEliminated && ' 💀'}
                      </p>
                      <p className="font-crimson text-moon-400/60 text-sm">
                        Voté par : {voterIds.map(id => getPlayerName(id)).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {eliminatedId && (
            <p className="font-cinzel text-xl text-moon-400/80 italic tracking-wide">
              Le conseil a parlé.
            </p>
          )}
        </div>
      </div>
    )
  }

  // MURDER ANNOUNCEMENT
  if (tvState.scene === 'murder') {
    const victimName = (tvState.data?.victim_name as string) ?? '???'

    return (
      <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-night-950 via-blood-900/10 to-night-950" />
        <div className="text-center relative z-10 animate-fade-in-up">
          <p className="font-crimson text-moon-400/60 text-2xl italic mb-8">
            Quand l'aube se lève...
          </p>
          <div className="text-6xl mb-6">💀</div>
          <h1 className="font-cinzel text-4xl font-bold text-red-400 tracking-wider mb-4">
            {victimName}
          </h1>
          <p className="font-crimson text-moon-400/80 text-xl italic">
            a été retrouvé(e) mort(e) au petit matin.
          </p>
        </div>
      </div>
    )
  }

  // LEADERBOARD
  if (tvState.scene === 'leaderboard') {
    const leaderData = (tvState.data?.entries as Array<{ name: string; score: number }>) ?? []
    const title = (tvState.data?.title as string) ?? 'Classement'

    return (
      <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-12">
        <h1 className="font-cinzel text-4xl font-bold text-parchment-100 tracking-[0.2em] mb-8">
          🏆 {title}
        </h1>
        <div className="w-full max-w-lg space-y-3">
          {leaderData.map((entry, idx) => {
            const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
            return (
              <div key={idx} className="bg-night-800/50 border border-night-700/30 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-2xl w-12 text-center">{rankEmoji}</span>
                  <span className="font-cinzel text-parchment-200 text-lg">{entry.name}</span>
                </div>
                <span className="font-cinzel text-candle-400 text-2xl font-bold">{entry.score}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // CUSTOM MESSAGE
  if (tvState.scene === 'custom_message') {
    const message = (tvState.data?.message as string) ?? ''
    return (
      <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-12">
        <div className="text-5xl mb-6">📢</div>
        <p className="font-cinzel text-4xl font-bold text-parchment-100 tracking-wider text-center max-w-3xl leading-relaxed">
          {message}
        </p>
      </div>
    )
  }

  // FINAL REVEAL
  if (tvState.scene === 'final_reveal') {
    const allPlayers = players.filter(p => p.status === 'alive' || p.status === 'ghost')
    const werewolfWin = gameState?.werewolf_count && gameState.werewolf_count > 0 && gameState.villager_count <= gameState.werewolf_count
    const allRevealed = revealIndex >= allPlayers.length

    return (
      <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <h1 className="font-cinzel text-4xl font-bold text-parchment-100 tracking-[0.3em] mb-10">
          🎭 RÉVÉLATION FINALE
        </h1>

        <div className="grid grid-cols-2 gap-4 max-w-2xl w-full mb-10">
          {allPlayers.map((p) => {
            const isRevealed = revealedRoles.has(p.id)
            const role = revealedRoles.get(p.id)
            return (
              <div
                key={p.id}
                className={`rounded-xl p-4 text-center transition-all duration-700 ${isRevealed
                    ? role === 'werewolf'
                      ? 'bg-blood-800/60 border-2 border-red-500/60'
                      : 'bg-candle-600/20 border-2 border-candle-500/40'
                    : 'bg-night-800/50 border border-night-700/30'
                  }`}
              >
                <p className="font-cinzel text-lg font-semibold text-parchment-200 mb-1">{p.name}</p>
                {isRevealed ? (
                  <div className="animate-fade-in-up">
                    <span className="text-3xl">{role === 'werewolf' ? '🐺' : '🏘️'}</span>
                    <p className={`font-cinzel text-sm mt-1 ${role === 'werewolf' ? 'text-red-400' : 'text-candle-400'}`}>
                      {role === 'werewolf' ? 'Loup-Garou' : 'Villageois'}
                    </p>
                  </div>
                ) : (
                  <div className="text-3xl">❓</div>
                )}
              </div>
            )
          })}
        </div>

        {allRevealed && (
          <div className="text-center animate-fade-in-up">
            <div className="text-5xl mb-4">{werewolfWin ? '🐺' : '🎉'}</div>
            <h2 className={`font-cinzel text-3xl font-bold tracking-wider ${werewolfWin ? 'text-red-400' : 'text-candle-400'}`}>
              {werewolfWin ? 'Les Loups-Garous gagnent !' : 'Les Villageois gagnent !'}
            </h2>
          </div>
        )}
      </div>
    )
  }

  return null
}

// Countdown sub-component for TV
function TVCountdown({ endTime }: { endTime: Date }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000)))

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const isUrgent = secondsLeft <= 60
  const isCritical = secondsLeft <= 10

  return (
    <div className={`font-cinzel text-8xl font-bold tabular-nums transition-colors ${isCritical ? 'text-red-500 animate-pulse' : isUrgent ? 'text-red-400' : 'text-candle-400'
      }`}>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  )
}
