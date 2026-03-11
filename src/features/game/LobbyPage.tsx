import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { useGameStore } from '../../stores/gameStore'
import { useAuthStore } from '../../stores/authStore'

export function LobbyPage() {
  const { players, isLoading } = useRealtimePlayers()
  const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
  const { player } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchGameState()
    const unsub = subscribeToGameState()
    return unsub
  }, [])

  // Auto-redirect based on game phase
  useEffect(() => {
    if (!gameState) return
    if (gameState.phase === 'role_reveal') {
      navigate('/reveal', { replace: true })
    } else if (gameState.phase === 'playing' || gameState.phase === 'final_vote') {
      navigate('/home', { replace: true })
    }
  }, [gameState?.phase])

  const connectedPlayers = players.filter(p => p.status !== undefined)
  const totalExpected = 16

  if (isLoading) {
    return (
      <div className="min-h-screen bg-village-night flex items-center justify-center">
        <div className="animate-candle text-candle-400 font-cinzel text-lg">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative moon */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-moon-200 to-moon-300 opacity-15 moon-glow" />

      <div className="text-center mb-8 relative z-10">
        <div className="text-4xl mb-3 animate-slow-pulse">🌙</div>
        <h1 className="font-cinzel text-2xl font-bold text-candle-400 tracking-[0.2em] animate-candle">
          EN ATTENTE D'ALLOCATION
        </h1>
        <p className="font-crimson text-moon-400 mt-2 italic">La nuit va bientôt tomber sur le village...</p>
      </div>

      <div className="bg-parchment-card rounded-xl p-6 w-full max-w-md mb-6 backdrop-blur-sm relative z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase">
            Villageois présents
          </h2>
          <span className="text-candle-400 font-cinzel text-lg">
            {connectedPlayers.length} / {totalExpected}
          </span>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {connectedPlayers.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${p.id === player?.id
                  ? 'bg-candle-500/10 border border-candle-500/30'
                  : 'bg-night-800/50 border border-night-700/30'
                }`}
            >
              <div className="w-2 h-2 rounded-full bg-candle-400 animate-candle" />
              <span className="font-crimson text-parchment-200">
                {p.name}
                {p.id === player?.id && (
                  <span className="text-candle-400 text-sm ml-2 italic">(toi)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-moon-400/60 text-sm text-center font-crimson italic relative z-10">
        Le Maître du Jeu lancera la partie quand tout le village sera réuni
      </p>
    </div>
  )
}
