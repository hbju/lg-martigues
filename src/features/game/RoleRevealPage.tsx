import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'
import { GiEclipse, GiWolfHead, GiVillage } from 'react-icons/gi'

type RevealStage = 'suspense' | 'revealing' | 'done'

export function RoleRevealPage() {
  const { player, refreshPlayer } = useAuthStore()
  const { gameState } = useGameStore()
  const navigate = useNavigate()
  const [stage, setStage] = useState<RevealStage>('suspense')

  useEffect(() => {
    // Refresh player to get the assigned role
    refreshPlayer()
  }, [])

  useEffect(() => {
    if (stage === 'suspense') {
      const timer = setTimeout(() => setStage('revealing'), 3500)
      return () => clearTimeout(timer)
    }
  }, [stage])

  const isWerewolf = player?.role === 'werewolf'
  const meetingPoint = (gameState?.metadata as Record<string, string>)?.meeting_point

  function handleDismiss() {
    setStage('done')
    navigate('/home', { replace: true })
  }

  if (stage === 'suspense') {
    return (
      <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Dark atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-night-950 via-night-900 to-night-950" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-moon-200/5 blur-3xl" />

        <div className="text-center animate-candle relative z-10">
          <p className="text-moon-300/60 text-4xl mb-6"><GiEclipse /></p>
          <p className="font-cinzel text-parchment-200/80 text-2xl tracking-wide">
            Ton destin est en train
          </p>
          <p className="font-cinzel text-parchment-200/80 text-2xl tracking-wide mt-1">
            d'être scellé...
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-night-600" />
            <p className="text-moon-400/50 text-sm font-crimson italic">Ne montre ton écran à personne</p>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-night-600" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 transition-all duration-1000 relative overflow-hidden ${isWerewolf
        ? 'bg-gradient-to-b from-blood-900 via-blood-800 to-night-950'
        : 'bg-gradient-to-b from-night-800 via-night-900 to-forest-900'
        }`}
    >
      {/* Atmospheric glow */}
      <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl ${isWerewolf ? 'bg-blood-500/10' : 'bg-candle-400/5'
        }`} />

      <div className="text-center animate-fade-in-up relative z-10">
        <div className="flex justify-center text-9xl mb-8">{isWerewolf ? <GiWolfHead /> : <GiVillage />}</div>

        <h1 className={`font-cinzel text-4xl font-bold mb-2 tracking-wider ${isWerewolf ? 'text-red-400' : 'text-candle-400'
          }`}>
          {isWerewolf ? 'Loup-Garou' : 'Villageois'}
        </h1>

        <div className="flex items-center justify-center gap-4 mb-6">
          <div className={`h-px w-16 ${isWerewolf ? 'bg-blood-500/50' : 'bg-candle-500/30'}`} />
          <div className={`w-2 h-2 rotate-45 ${isWerewolf ? 'bg-blood-500' : 'bg-candle-500'}`} />
          <div className={`h-px w-16 ${isWerewolf ? 'bg-blood-500/50' : 'bg-candle-500/30'}`} />
        </div>

        <p className={`font-crimson text-lg italic mb-8 max-w-xs mx-auto ${isWerewolf ? 'text-red-300/80' : 'text-parchment-200/80'
          }`}>
          {isWerewolf
            ? 'Tu es un Loup-Garou. Dévore les villageois sans te faire repérer.'
            : 'Tu es un Villageois. Ne fais confiance à personne.'}
        </p>

        {isWerewolf && meetingPoint && (
          <div className="bg-blood-800/40 border border-blood-500/30 rounded-lg p-4 mb-8 max-w-sm backdrop-blur-sm">
            <p className="text-red-300/80 text-sm font-cinzel tracking-wider mb-2">Point de rendez-vous secret</p>
            <p className="text-red-200 font-crimson italic">{meetingPoint}</p>
          </div>
        )}

        <button
          onClick={handleDismiss}
          className={`font-cinzel py-3 px-10 rounded-lg font-semibold text-lg transition-all ${isWerewolf
            ? 'bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 shadow-lg shadow-blood-700/30'
            : 'bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 text-night-950 shadow-lg shadow-candle-500/20'
            }`}
        >
          J'ai compris
        </button>
      </div>
    </div>
  )
}
