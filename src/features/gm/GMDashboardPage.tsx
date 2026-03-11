import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { useGameStore } from '../../stores/gameStore'
import { useAuthStore } from '../../stores/authStore'

export function GMDashboardPage() {
  const { players } = useRealtimePlayers()
  const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
  const [werewolfCount, setWerewolfCount] = useState(3)
  const [meetingPoint, setMeetingPoint] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const { logout } = useAuthStore()

  useEffect(() => {
    fetchGameState()
    const unsub = subscribeToGameState()
    return unsub
  }, [])

  const alivePlayers = players.filter(p => p.status !== undefined)
  const canStart = alivePlayers.length >= 4 // minimum for a game

  async function handleAssignRoles() {
    if (!confirm(`Assigner les rôles ? (${werewolfCount} loups-garous)`)) return

    setIsAssigning(true)

    // Shuffle players (Fisher-Yates)
    const shuffled = [...players.filter(p => !p.is_gm)]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Assign roles
    const updates = shuffled.map((player, index) => ({
      id: player.id,
      role: index < werewolfCount ? 'werewolf' as const : 'villager' as const,
      status: 'alive' as const,
    }))

    // Update each player
    for (const update of updates) {
      await supabase
        .from('players')
        .update({ role: update.role, status: update.status })
        .eq('id', update.id)
    }

    // Update game state
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

  const phaseLabels: Record<string, string> = {
    setup: '🔧 Préparation',
    role_reveal: '🎭 Révélation des rôles',
    playing: '🎮 En cours',
    final_vote: '🗳️ Vote final',
    finished: '🏁 Terminé',
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">
            Maître du Jeu
          </h1>
          <Link
            to="/gm/qr-codes"
            className="bg-night-700 hover:bg-night-600 text-parchment-200 py-2 px-4 rounded-lg transition-colors font-crimson border border-night-600"
          >
            📱 QR Codes
          </Link>
        </div>

        {/* Game phase */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
          <p className="font-crimson text-moon-400 text-sm italic">Phase actuelle</p>
          <p className="font-cinzel text-candle-400 text-xl font-semibold mt-1">
            {gameState ? phaseLabels[gameState.phase] || gameState.phase : 'Chargement...'}
          </p>
        </div>

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
                      {p.role === 'werewolf' ? '🐺 Loup' : '🏘️ Villageois'}
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
                {isAssigning ? 'Attribution en cours...' : `🎲 Assigner les rôles (${players.length} joueurs)`}
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
              ▶️ Passer en mode Jeu
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
