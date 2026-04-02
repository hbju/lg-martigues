import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'
import { useVoteStore } from '../../stores/voteStore'
import { useNotificationStore } from '../../stores/notificationStore'
import { NotificationBell } from '../../components/ui/NotificationBell'
import { EliminationOverlay } from '../../components/ui/EliminationOverlay'
import { useChallengeStore } from '../../stores/challengeStore'
import { GiGhost, GiWolfHead, GiVillage, GiBackpack, GiBeerStein, GiTestTubes, GiTrophy } from 'react-icons/gi'
import { RiHeartFill, RiHourglassFill, RiCameraFill } from 'react-icons/ri'

export function HomePage() {
  const { player, logout, refreshPlayer } = useAuthStore()
  const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
  const { currentRound, subscribeToRounds } = useVoteStore()
  const { subscribe: subscribeNotifs } = useNotificationStore()
  const { challenges, subscribeToAll } = useChallengeStore()
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

  // Redirect to vote screen when a council/final round opens
  useEffect(() => {
    if (!currentRound || !player || player.status !== 'alive') return
    if (currentRound.status !== 'open') return

    if (currentRound.metadata?.subtype === 'continue_poll') {
      navigate('/vote/continue', { replace: true })
    } else if ((currentRound.type === 'council' || currentRound.type === 'final') && currentRound.status === 'open') {
      navigate('/vote', { replace: true })
    }
  }, [currentRound?.id, currentRound?.status])

  // Redirect to final reveal when game ends
  useEffect(() => {
    if (gameState?.phase === 'finished') {
      navigate('/reveal/final', { replace: true })
    }
  }, [gameState?.phase])

  if (!player) return null

  const isGhost = player.status === 'ghost'

  const phaseLabels: Record<string, string> = {
    setup: 'Préparation',
    role_reveal: 'Révélation des rôles',
    playing: 'En cours',
    final_vote: 'Vote final',
    finished: 'Terminé',
  }

  const beerPong = challenges.find(c => c.type === 'beer_pong')
  const madScientists = challenges.find(c => c.type === 'mad_scientists')
  console.log("Available challenges on HomePage:", { beerPong, madScientists })

  useEffect(() => {
    const unsub = subscribeToAll()
    return unsub
  }, [])

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
              {isGhost && <span className="ml-2 text-lg"><GiGhost className="inline" /></span>}
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
            <p className="font-cinzel text-moon-400/60 tracking-wider text-sm"><GiGhost className="inline" /> Tu es un Fantôme</p>
            <p className="font-crimson text-moon-400/40 text-xs mt-1 italic">
              Tu observes le jeu, mais ne peux plus voter.
            </p>
          </div>
        )}

        {/* Role card */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{player.role === 'werewolf' ? <GiWolfHead /> : <GiVillage />}</span>
            <div>
              <p className="font-cinzel text-parchment-100 font-medium tracking-wide">
                {player.role === 'werewolf' ? 'Loup-Garou' : 'Villageois'}
              </p>
              <p className="font-crimson text-moon-400 text-sm italic">
                {player.status === 'alive' ? <><RiHeartFill className="inline text-red-400" /> En vie</> : player.status === 'ghost' ? <><GiGhost className="inline" /> Éliminé</> : <><RiHourglassFill className="inline" /> En attente</>}
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
              <span className="text-xl"><GiWolfHead /></span>
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

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            to="/inventory"
            className="bg-parchment-card rounded-xl p-4 text-center hover:bg-night-800/40 transition-colors backdrop-blur-sm"
          >
            <div className="flex justify-center text-2xl mb-1"><GiBackpack /></div>
            <p className="font-cinzel text-candle-400 text-sm font-semibold">Inventaire</p>
            <p className="font-crimson text-moon-400/60 text-xs">Boucliers & Clairvoyances</p>
          </Link>
          <Link
            to="/scan"
            className="bg-parchment-card rounded-xl p-4 text-center hover:bg-night-800/40 transition-colors backdrop-blur-sm"
          >
            <div className="flex justify-center text-2xl mb-1"><RiCameraFill /></div>
            <p className="font-cinzel text-candle-400 text-sm font-semibold">Scanner QR</p>
            <p className="font-crimson text-moon-400/60 text-xs">Trouver des récompenses</p>
          </Link>
        </div>

        {/* Challenges */}
        {challenges.length > 0 && (
          <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
            <h2 className="font-cinzel text-parchment-100 font-semibold mb-3 text-sm tracking-wider uppercase">
              <GiTrophy className="inline" /> Challenges
            </h2>
            <div className="space-y-2">
              {beerPong && (
                <Link
                  to="/challenges/beer-pong"
                  className="flex items-center gap-3 p-3 bg-night-800/50 border border-night-700/30 rounded-lg hover:bg-night-800/70 transition-colors"
                >
                  <span className="text-lg"><GiBeerStein /></span>
                  <span className="font-crimson text-parchment-200 text-sm">Beer Pong</span>
                </Link>)}
              {madScientists && (
                <Link
                  to="/challenges/mad-scientists"
                  className="flex items-center gap-3 p-3 bg-night-800/50 border border-night-700/30 rounded-lg hover:bg-night-800/70 transition-colors"
                >
                  <span className="text-lg"><GiTestTubes /></span>
                  <span className="font-crimson text-parchment-200 text-sm">Savants Fous</span>
                </Link>)}
            </div>

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
