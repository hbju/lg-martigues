import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { useGameStore } from '../../stores/gameStore'
import { useAuthStore } from '../../stores/authStore'
import { useNotificationStore } from '../../stores/notificationStore'
import { NotificationBell } from '../../components/ui/NotificationBell'
import type { GameState, Player } from '../../types/supabase'
import { GiWolfHead, GiVillage, GiVote, GiBiohazard, GiCheckedShield, GiTrophy, GiRollingDices, GiFinishLine, GiScales, GiGamepadCross, GiDeathSkull, GiNightSleep, GiHealthNormal } from 'react-icons/gi'
import { RiQrCodeFill, RiMegaphoneFill, RiTvFill, RiGiftFill, RiCheckboxCircleFill, RiPlayFill, RiErrorWarningFill } from 'react-icons/ri'

export function GMDashboardPage() {
  const { players } = useRealtimePlayers()
  const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
  const [werewolfCount, setWerewolfCount] = useState(3)
  const [meetingPoint, setMeetingPoint] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const { player: gmPlayer, logout } = useAuthStore()
  const { subscribe: subscribeNotifs } = useNotificationStore()

  useEffect(() => {
    fetchGameState()
    const unsub = subscribeToGameState()
    return unsub
  }, [])

  useEffect(() => {
    if (!gmPlayer) return
    const unsub = subscribeNotifs(gmPlayer.id)
    return unsub
  }, [gmPlayer?.id])

  const alivePlayers = players.filter(p => p.status !== undefined)
  const canStart = alivePlayers.length >= 3

  const metadata = (gameState?.metadata ?? {}) as Record<string, unknown>
  const discoveryConfirmed = metadata.werewolf_discovery_confirmed === true
  const infectionPending = metadata.infection_pending === true

  async function handleAssignRoles() {
    if (!confirm(`Assigner les rôles ? (${werewolfCount} loups-garous)`)) return

    setIsAssigning(true)

    const shuffled = [...players.filter(p => !p.is_gm)]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const updates = shuffled.map((player, index) => ({
      id: player.id,
      role: index < werewolfCount ? 'werewolf' as const : 'villager' as const,
      status: 'alive' as const,
    }))

    for (const update of updates) {
      await supabase
        .from('players')
        .update({ role: update.role, status: update.status })
        .eq('id', update.id)
    }

    await supabase
      .from('game_state')
      .update({
        phase: 'role_reveal',
        metadata: meetingPoint ? { meeting_point: meetingPoint } : null,
        werewolf_count: werewolfCount,
        villager_count: shuffled.length - werewolfCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    setIsAssigning(false)
    setShowRoles(true)
  }

  async function handleAdvanceToPlaying() {
    await supabase
      .from('game_state')
      .update({ phase: 'playing', updated_at: new Date().toISOString() })
      .eq('id', 1)
  }

  async function handleToggleWerewolfDiscovery() {
    if (!gameState) return
    const newVal = !discoveryConfirmed
    await supabase
      .from('game_state')
      .update({
        metadata: { ...(gameState.metadata ?? {}), werewolf_discovery_confirmed: newVal },
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
  }

  const phaseLabels: Record<string, { icon: React.ReactNode; label: string }> = {
    setup: { icon: <GiRollingDices />, label: 'Préparation' },
    role_reveal: { icon: <GiScales />, label: 'Révélation des rôles' },
    playing: { icon: <GiGamepadCross />, label: 'En cours' },
    final_vote: { icon: <GiVote />, label: 'Vote final' },
    finished: { icon: <GiFinishLine />, label: 'Terminé' },
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">
            Maître du Jeu
          </h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link
              to="/gm/qr-codes"
              className="bg-night-700 hover:bg-night-600 text-parchment-200 py-2 px-4 rounded-lg transition-colors font-crimson border border-night-600"
            >
              <RiQrCodeFill className="inline" /> QR Codes
            </Link>
          </div>
        </div>

        {/* Game phase */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
          <p className="font-crimson text-moon-400 text-sm italic">Phase actuelle</p>
          <p className="font-cinzel text-candle-400 text-xl font-semibold mt-1 inline-flex items-center gap-2">
            {gameState ? (phaseLabels[gameState.phase] ? <>{phaseLabels[gameState.phase].icon} {phaseLabels[gameState.phase].label}</> : gameState.phase) : 'Chargement...'}
          </p>
        </div>

        {/* Action buttons — only visible during playing phase */}
        {(gameState?.phase === 'playing' || gameState?.phase === 'final_vote') && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Link
              to="/gm/votes"
              className="bg-candle-600/20 border border-candle-500/30 rounded-xl p-4 text-center hover:bg-candle-600/30 transition-colors"
            >
              <div className="text-2xl mb-1"><GiVote /></div>
              <p className="font-cinzel text-candle-400 text-sm font-semibold">Votes</p>
            </Link>
            <Link
              to="/gm/murder"
              className="bg-blood-800/20 border border-blood-500/30 rounded-xl p-4 text-center hover:bg-blood-800/30 transition-colors"
            >
              <div className="text-2xl mb-1"><GiWolfHead /></div>
              <p className="font-cinzel text-red-400 text-sm font-semibold">Meurtres</p>
            </Link>
            <Link
              to="/gm/infection"
              className={`border rounded-xl p-4 text-center transition-colors ${infectionPending
                ? 'bg-blood-800/30 border-blood-500/50 animate-pulse'
                : 'bg-night-800/30 border-night-700/30 hover:bg-night-800/40'
                }`}
            >
              <div className="text-2xl mb-1"><GiBiohazard /></div>
              <p className={`font-cinzel text-sm font-semibold ${infectionPending ? 'text-red-400' : 'text-moon-400'}`}>
                Infection {infectionPending && <RiErrorWarningFill className="inline" />}
              </p>
            </Link>
            <Link
              to="/gm/broadcast"
              className="bg-night-800/30 border border-night-700/30 rounded-xl p-4 text-center hover:bg-night-800/40 transition-colors"
            >
              <div className="text-2xl mb-1"><RiMegaphoneFill /></div>
              <p className="font-cinzel text-moon-400 text-sm font-semibold">Annonce</p>
            </Link>
          </div>
        )}

        {/* Sprint 3 — Management section */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            to="/gm/power-ups"
            className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 text-center hover:bg-purple-900/30 transition-colors"
          >
            <div className="text-2xl mb-1"><GiCheckedShield /></div>
            <p className="font-cinzel text-purple-400 text-sm font-semibold">Power-ups</p>
          </Link>
          <Link
            to="/gm/reward-qr"
            className="bg-candle-600/10 border border-candle-500/20 rounded-xl p-4 text-center hover:bg-candle-600/20 transition-colors"
          >
            <div className="text-2xl mb-1"><RiGiftFill /></div>
            <p className="font-cinzel text-candle-400 text-sm font-semibold">QR Rewards</p>
          </Link>
          <Link
            to="/gm/challenges"
            className="bg-forest-700/20 border border-green-800/30 rounded-xl p-4 text-center hover:bg-forest-700/30 transition-colors"
          >
            <div className="text-2xl mb-1"><GiTrophy /></div>
            <p className="font-cinzel text-green-400 text-sm font-semibold">Challenges</p>
          </Link>
          <Link
            to="/tv"
            className="bg-night-800/30 border border-night-700/30 rounded-xl p-4 text-center hover:bg-night-800/40 transition-colors"
          >
            <div className="text-2xl mb-1"><RiTvFill /></div>
            <p className="font-cinzel text-moon-400 text-sm font-semibold">TV View</p>
          </Link>
          <Link
            to="/gm/checklist"
            className="bg-forest-700/10 border border-green-800/20 rounded-xl p-4 text-center hover:bg-forest-700/20 transition-colors"
          >
            <div className="text-2xl mb-1"><RiCheckboxCircleFill /></div>
            <p className="font-cinzel text-green-400 text-sm font-semibold">Checklist</p>
          </Link>
          <Link
            to="/gm/health"
            className="bg-night-800/30 border border-night-700/30 rounded-xl p-4 text-center hover:bg-night-800/40 transition-colors"
          >
            <div className="text-2xl mb-1"><GiHealthNormal /></div>
            <p className="font-cinzel text-moon-400 text-sm font-semibold">Diagnostic</p>
          </Link>
        </div>

        {/* TV Scene Control */}
        <TVControl gameState={gameState} players={players} />

        {/* Werewolf discovery toggle */}
        {gameState?.phase === 'playing' && (
          <div className="bg-blood-800/10 border border-blood-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-cinzel text-red-400/80 text-sm font-semibold">Découverte des loups</p>
                <p className="font-crimson text-moon-400/60 text-xs">
                  {discoveryConfirmed ? 'Les loups peuvent se coordonner' : 'Les loups ne voient pas encore leurs alliés'}
                </p>
              </div>
              <button
                onClick={handleToggleWerewolfDiscovery}
                className={`px-4 py-2 rounded-lg font-crimson text-sm transition-colors border ${discoveryConfirmed
                  ? 'bg-blood-500/20 border-blood-500/40 text-red-400'
                  : 'bg-night-700 border-night-600 text-moon-400 hover:bg-night-600'
                  }`}
              >
                {discoveryConfirmed ? <><RiCheckboxCircleFill className="inline" /> Confirmée</> : 'Confirmer'}
              </button>
            </div>
          </div>
        )}

        {/* Player list */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase">
              Villageois ({players.length})
            </h2>
            {gameState?.phase !== 'setup' && (
              <button
                onClick={() => setShowRoles(!showRoles)}
                className="text-candle-400 text-sm hover:text-candle-500 transition-colors font-crimson"
              >
                {showRoles ? 'Masquer rôles' : 'Voir rôles'}
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2.5 bg-night-800/50 border border-night-700/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${p.status === 'alive' ? 'bg-candle-400 animate-candle' :
                    p.status === 'ghost' ? 'bg-night-600' : 'bg-moon-400'
                    }`} />
                  <span className="font-crimson text-parchment-200">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {showRoles && p.role && (
                    <span className={`text-sm px-2 py-0.5 rounded font-crimson ${p.role === 'werewolf' ? 'bg-blood-800/60 text-red-300 border border-blood-500/30' : 'bg-candle-600/20 text-candle-400 border border-candle-500/20'
                      }`}>
                      {p.role === 'werewolf' ? <><GiWolfHead className="inline" /> Loup</> : <><GiVillage className="inline" /> Villageois</>}
                    </span>
                  )}
                  <span className="text-moon-400/50 text-xs font-crimson italic">{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role assignment controls (only in setup phase) */}
        {gameState?.phase === 'setup' && (
          <div className="bg-parchment-card rounded-xl p-5 mb-6 backdrop-blur-sm">
            <h2 className="font-cinzel text-parchment-100 font-semibold mb-4 tracking-wider uppercase text-sm">
              Lancer la partie
            </h2>

            <div className="space-y-4">
              <div>
                <label className="font-crimson text-moon-400 text-sm block mb-1">
                  Nombre de loups-garous : <span className="text-candle-400 font-semibold">{werewolfCount}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, Math.floor(players.length / 3))}
                  value={werewolfCount}
                  onChange={(e) => setWerewolfCount(Number(e.target.value))}
                  className="w-full accent-candle-500"
                />
              </div>

              <div>
                <label className="font-crimson text-moon-400 text-sm block mb-1">
                  Point de rendez-vous des loups
                </label>
                <input
                  type="text"
                  value={meetingPoint}
                  onChange={(e) => setMeetingPoint(e.target.value)}
                  placeholder="Ex: Derrière le canapé du salon"
                  className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson placeholder:text-night-600"
                />
              </div>

              <button
                onClick={handleAssignRoles}
                disabled={!canStart || isAssigning}
                className="w-full bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 disabled:from-night-700 disabled:to-night-700 disabled:text-night-600 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all shadow-lg shadow-candle-500/20"
              >
                {isAssigning ? 'Attribution en cours...' : <><GiRollingDices className="inline" /> Assigner les rôles ({players.length} joueurs)</>}
              </button>

              {!canStart && (
                <p className="text-candle-400/60 text-sm text-center font-crimson italic">
                  Minimum 4 joueurs requis pour lancer la partie
                </p>
              )}
            </div>
          </div>
        )}

        {/* Advance to playing (after role reveal) */}
        {gameState?.phase === 'role_reveal' && (
          <div className="bg-parchment-card rounded-xl p-4 backdrop-blur-sm">
            <button
              onClick={handleAdvanceToPlaying}
              className="w-full bg-gradient-to-b from-forest-700 to-forest-800 hover:from-forest-700/90 hover:to-forest-700 text-parchment-100 font-cinzel font-semibold py-3 rounded-lg transition-all border border-green-800/30"
            >
              <RiPlayFill className="inline" /> Passer en mode Jeu
            </button>
          </div>
        )}

        <button
          onClick={logout}
          className="mt-8 w-full text-moon-400/40 hover:text-parchment-200 text-sm py-2 transition-colors font-crimson"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}

// ─── TV Scene Control ───

function TVControl({ gameState, players }: { gameState: GameState | null; players: Player[] }) {
  const [customMessage, setCustomMessage] = useState('')

  async function setTVScene(scene: string, data?: Record<string, unknown>) {
    if (!gameState) return
    const meta = (gameState.metadata ?? {}) as Record<string, unknown>
    await supabase
      .from('game_state')
      .update({
        metadata: { ...meta, tv_state: { scene, data } },
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
  }

  async function handleMurderAnnouncement() {
    const name = prompt('Nom de la victime :')
    if (!name) return
    await setTVScene('murder', { victim_name: name })
  }

  async function handleLeaderboard() {
    // Fetch latest challenge scores for a quick leaderboard
    const { data: scores } = await supabase
      .from('challenge_scores')
      .select('player_id, score')
      .order('score', { ascending: false })
      .limit(20)

    if (!scores?.length) {
      alert('Aucun score disponible.')
      return
    }

    // Group by player, sum scores
    const totals = new Map<string, number>()
    scores.forEach((s: { player_id: string | null; score: number }) => {
      if (!s.player_id) return
      totals.set(s.player_id, (totals.get(s.player_id) ?? 0) + s.score)
    })

    const entries = Array.from(totals.entries())
      .map(([pid, score]) => ({
        name: players.find(p => p.id === pid)?.name ?? 'Inconnu',
        score,
      }))
      .sort((a, b) => b.score - a.score)

    await setTVScene('leaderboard', { title: 'Classement Challenges', entries })
  }

  async function handleCustomMessage() {
    if (!customMessage.trim()) return
    await setTVScene('custom_message', { message: customMessage.trim() })
    setCustomMessage('')
  }

  return (
    <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
      <h2 className="font-cinzel text-parchment-100 font-semibold mb-3 text-sm tracking-wider uppercase">
        <RiTvFill className="inline" /> Contrôle TV
      </h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => setTVScene('idle')}
          className="bg-night-800/50 border border-night-700/30 rounded-lg py-2 px-3 text-sm font-crimson text-parchment-200 hover:bg-night-800/70 transition-colors"
        >
          <GiNightSleep className="inline" /> Écran veille
        </button>
        <button
          onClick={handleMurderAnnouncement}
          className="bg-blood-800/30 border border-blood-500/30 rounded-lg py-2 px-3 text-sm font-crimson text-red-300 hover:bg-blood-800/40 transition-colors"
        >
          <GiDeathSkull className="inline" /> Annonce meurtre
        </button>
        <button
          onClick={handleLeaderboard}
          className="bg-candle-600/20 border border-candle-500/30 rounded-lg py-2 px-3 text-sm font-crimson text-candle-400 hover:bg-candle-600/30 transition-colors"
        >
          <GiTrophy className="inline" /> Classement
        </button>
        <button
          onClick={() => setTVScene('final_reveal')}
          className="bg-purple-900/30 border border-purple-500/30 rounded-lg py-2 px-3 text-sm font-crimson text-purple-300 hover:bg-purple-900/40 transition-colors"
        >
          <GiScales className="inline" /> Révélation finale
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customMessage}
          onChange={e => setCustomMessage(e.target.value)}
          placeholder="Message personnalisé..."
          className="flex-1 bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson text-sm placeholder:text-night-600"
        />
        <button
          onClick={handleCustomMessage}
          disabled={!customMessage.trim()}
          className="bg-candle-600/20 border border-candle-500/30 rounded-lg py-2 px-3 text-sm font-crimson text-candle-400 hover:bg-candle-600/30 transition-colors disabled:opacity-40"
        >
          <RiMegaphoneFill />
        </button>
      </div>
    </div>
  )
}
