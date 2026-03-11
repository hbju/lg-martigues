import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'
import { useVoteStore } from '../../stores/voteStore'
import { useNotificationStore } from '../../stores/notificationStore'
import { NotificationBell } from '../../components/ui/NotificationBell'
import { EliminationOverlay } from '../../components/ui/EliminationOverlay'

export function HomePage() {
  const { player, logout, refreshPlayer } = useAuthStore()
  const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
  const { currentRound, subscribeToRounds } = useVoteStore()
  const { subscribe: subscribeNotifs } = useNotificationStore()
  const navigate = useNavigate()
  const [showElimination, setShowElimination] = useState(false)
  const [eliminationMethod] = useState<'council' | 'werewolf'>('council')
  const [prevStatus, setPrevStatus] = useState(player?.status)

  useEffect(() => {
    fetchGameState()
    const unsub1 = subscribeToGameState()
    const unsub2 = subscribeToRounds()
    return () => { unsub1(); unsub2() }
  }, [])

  // Subscribe to notifications
  useEffect(() => {
    if (!player) return
    const unsub = subscribeNotifs(player.id)
    return unsub
  }, [player?.id])

  // Poll player status for elimination detection
  useEffect(() => {
    if (!player) return
    const interval = setInterval(() => refreshPlayer(), 5000)
    return () => clearInterval(interval)
  }, [player?.id])

  // Detect elimination transition
  useEffect(() => {
    if (!player) return
    if (prevStatus === 'alive' && player.status === 'ghost') {
      setShowElimination(true)
    }
    setPrevStatus(player.status)
  }, [player?.status])

  // Redirect to vote screen when a council round opens
  useEffect(() => {
    if (currentRound?.type === 'council' && currentRound.status === 'open' && player?.status === 'alive') {
      navigate('/vote', { replace: true })
    }
  }, [currentRound?.id, currentRound?.status])

  if (!player) return null

  const isGhost = player.status === 'ghost'

  const phaseLabels: Record<string, string> = {
    setup: 'Préparation',
    role_reveal: 'Révélation des rôles',
    playing: 'En cours',
    final_vote: 'Vote final',
    finished: 'Terminé',
  }

  return (
    <div className={`min-h-screen bg-village-night p-6 ${isGhost ? 'ghost-mode' : ''}`}>
      {/* Elimination overlay */}
      {showElimination && (
        <EliminationOverlay
          method={eliminationMethod}
          onDismiss={() => setShowElimination(false)}
        />
      )}

      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">
              {player.name}
              {isGhost && <span className="ml-2 text-lg">👻</span>}
            </h1>
            <p className="font-crimson text-moon-400 text-sm italic">
              {gameState ? phaseLabels[gameState.phase] || gameState.phase : '...'}
            </p>
          </div>
          <NotificationBell />
        </div>

        {/* Ghost badge */}
        {isGhost && (
          <div className="bg-night-800/60 border border-night-600/50 rounded-xl p-4 mb-6 text-center">
            <p className="font-cinzel text-moon-400/60 tracking-wider text-sm">👻 Tu es un Fantôme</p>
            <p className="font-crimson text-moon-400/40 text-xs mt-1 italic">
              Tu observes le jeu, mais ne peux plus voter.
            </p>
          </div>
        )}

        {/* Role card */}
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

        {/* Werewolf link (only for alive werewolves) */}
        {player.role === 'werewolf' && player.status === 'alive' && (
          <button
            onClick={() => navigate('/werewolf')}
            className="w-full bg-blood-800/30 border border-blood-500/30 rounded-xl p-4 mb-6 text-left hover:bg-blood-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🐺</span>
              <div>
                <p className="font-cinzel text-red-400 font-medium text-sm tracking-wide">Tanière des Loups</p>
                <p className="font-crimson text-red-300/60 text-xs">Accéder au canal privé</p>
              </div>
            </div>
          </button>
        )}

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
        {!isGhost && (
          <div className="bg-night-800/30 rounded-xl p-4 border border-night-700/30 border-dashed">
            <p className="text-moon-400/40 text-center text-sm font-crimson italic">
              🕐 Prochain événement à venir...
            </p>
          </div>
        )}

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
