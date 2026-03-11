import { useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'

export function HomePage() {
  const { player, logout } = useAuthStore()
  const { gameState, fetchGameState, subscribeToGameState } = useGameStore()

  useEffect(() => {
    fetchGameState()
    const unsub = subscribeToGameState()
    return unsub
  }, [])

  if (!player) return null

  const phaseLabels: Record<string, string> = {
    setup: 'Préparation',
    role_reveal: 'Révélation des rôles',
    playing: 'En cours',
    final_vote: 'Vote final',
    finished: 'Terminé',
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">{player.name}</h1>
            <p className="font-crimson text-moon-400 text-sm italic">
              {gameState ? phaseLabels[gameState.phase] || gameState.phase : '...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-moon-400 hover:text-candle-400 transition-colors text-xl">
              🔔
            </button>
          </div>
        </div>

        {/* Role card - discreet, parchment style */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{player.role === 'werewolf' ? '🐺' : '🏘️'}</span>
            <div>
              <p className="font-cinzel text-parchment-100 font-medium tracking-wide">
                {player.role === 'werewolf' ? 'Loup-Garou' : 'Villageois'}
              </p>
              <p className="font-crimson text-moon-400 text-sm italic">
                {player.status === 'alive' ? '❤️ En vie' : player.status === 'ghost' ? '👻 Éliminé' : '⏳ En attente'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-parchment-card rounded-xl p-4 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold text-candle-400 font-cinzel">{player.shields}</p>
            <p className="font-crimson text-moon-400 text-sm">Boucliers</p>
          </div>
          <div className="bg-parchment-card rounded-xl p-4 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold text-purple-400 font-cinzel">{player.clairvoyance_count}</p>
            <p className="font-crimson text-moon-400 text-sm">Clairvoyances</p>
          </div>
        </div>

        {/* Game info */}
        {gameState && (
          <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
            <h2 className="font-cinzel text-parchment-100 font-semibold mb-3 text-sm tracking-wider uppercase">
              État du village
            </h2>
            <div className="space-y-2 text-sm font-crimson">
              <div className="flex justify-between">
                <span className="text-moon-400">Manche</span>
                <span className="text-parchment-200">{gameState.current_round}</span>
              </div>
              <div className="h-px bg-night-700/50" />
              <div className="flex justify-between">
                <span className="text-moon-400">Loups restants</span>
                <span className="text-red-400">{gameState.werewolf_count}</span>
              </div>
              <div className="h-px bg-night-700/50" />
              <div className="flex justify-between">
                <span className="text-moon-400">Villageois restants</span>
                <span className="text-candle-400">{gameState.villager_count}</span>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder for next events */}
        <div className="bg-night-800/30 rounded-xl p-4 border border-night-700/30 border-dashed">
          <p className="text-moon-400/40 text-center text-sm font-crimson italic">
            🕐 Prochain événement à venir...
          </p>
        </div>

        {/* Logout */}
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
