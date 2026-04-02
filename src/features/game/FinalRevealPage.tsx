import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../stores/gameStore'
import { useAuthStore } from '../../stores/authStore'
import { motion, AnimatePresence } from 'framer-motion'
import type { Player } from '../../types/supabase'
import { GiWolfHead, GiVillage, GiMoon, GiFire, GiScrollUnfurled, GiScales } from 'react-icons/gi'
import { RiQuestionFill } from 'react-icons/ri'

export function FinalRevealPage() {
  const { gameState, fetchGameState, subscribeToGameState } = useGameStore()
  const { player } = useAuthStore()
  const navigate = useNavigate()
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [revealedIndex, setRevealedIndex] = useState(-1)
  const [showWinner, setShowWinner] = useState(false)

  useEffect(() => {
    fetchGameState()
    const unsub = subscribeToGameState()
    return unsub
  }, [])

  useEffect(() => {
    fetchPlayers()
  }, [])

  useEffect(() => {
    if (gameState?.phase !== 'finished') return
    // Start dramatic reveal sequence
    const survivors = allPlayers.filter(p => p.status === 'alive')
    if (survivors.length === 0) return

    let idx = 0
    const interval = setInterval(() => {
      setRevealedIndex(idx)
      idx++
      if (idx >= survivors.length) {
        clearInterval(interval)
        // Show winner after last reveal
        setTimeout(() => setShowWinner(true), 2000)
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [gameState?.phase, allPlayers.length])

  async function fetchPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('is_gm', false)
      .order('name')
    if (data) setAllPlayers(data as Player[])
  }

  if (!player || !gameState) return null

  const metadata = (gameState.metadata ?? {}) as Record<string, unknown>
  const winner = metadata.winner as string | undefined
  const survivors = allPlayers.filter(p => p.status === 'alive')

  const werewolvesWin = winner === 'werewolves'

  return (
    <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effect */}
      <div className={`absolute inset-0 transition-all duration-1000 ${showWinner
        ? werewolvesWin
          ? 'bg-gradient-to-b from-blood-900/30 via-night-950 to-blood-900/20'
          : 'bg-gradient-to-b from-candle-600/15 via-night-950 to-candle-600/10'
        : ''
        }`} />

      <div className="text-center relative z-10 max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-cinzel text-3xl font-bold text-parchment-100 tracking-[0.2em] mb-2 inline-flex items-center gap-3">
            <GiScales /> Révélation Finale
          </h1>
          <p className="font-crimson text-moon-400 italic mb-10">
            Les masques tombent...
          </p>
        </motion.div>

        {/* Survivor cards */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          <AnimatePresence>
            {survivors.map((p, idx) => {
              const isRevealed = idx <= revealedIndex
              return (
                <motion.div
                  key={p.id}
                  initial={{ rotateY: 180, opacity: 0 }}
                  animate={isRevealed
                    ? { rotateY: 0, opacity: 1 }
                    : { rotateY: 180, opacity: 0.4 }
                  }
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`rounded-xl p-4 text-center border-2 transition-colors duration-500 ${isRevealed
                    ? p.role === 'werewolf'
                      ? 'bg-blood-800/60 border-red-500/60'
                      : 'bg-candle-600/20 border-candle-500/40'
                    : 'bg-night-800/50 border-night-700/30'
                    }`}
                  style={{ perspective: '1000px' }}
                >
                  <p className="font-cinzel text-lg font-semibold text-parchment-200 mb-1">
                    {p.name}
                  </p>
                  {isRevealed ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <span className="text-2xl">
                        {p.role === 'werewolf' ? <GiWolfHead /> : <GiVillage />}
                      </span>
                      <p className={`font-crimson text-sm mt-1 ${p.role === 'werewolf' ? 'text-red-400' : 'text-candle-400'
                        }`}>
                        {p.role === 'werewolf' ? 'Loup-Garou' : 'Villageois'}
                      </p>
                    </motion.div>
                  ) : (
                    <span className="text-2xl"><RiQuestionFill /></span>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Winner announcement */}
        <AnimatePresence>
          {showWinner && winner && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="mb-8"
            >
              <div className={`text-6xl mb-4 flex items-center justify-center gap-2 ${werewolvesWin ? 'animate-pulse' : ''}`}>
                {werewolvesWin ? <><GiWolfHead /><GiMoon /></> : <><GiVillage /><GiFire /></>}
              </div>
              <h2 className={`font-cinzel text-4xl font-bold tracking-wider mb-3 ${werewolvesWin ? 'text-red-400' : 'text-candle-400'
                }`}>
                {werewolvesWin
                  ? 'LES LOUPS-GAROUS GAGNENT !'
                  : 'LES VILLAGEOIS GAGNENT !'
                }
              </h2>
              <p className="font-crimson text-moon-400 text-lg italic">
                {werewolvesWin
                  ? 'Les loups ont dévoré le village...'
                  : 'Le village est enfin en sécurité !'
                }
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        {showWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="space-y-3"
          >
            <button
              onClick={() => navigate('/recap')}
              className="w-full bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all shadow-lg shadow-candle-500/20"
            >
              <GiScrollUnfurled className="inline" /> Voir le récapitulatif
            </button>
            <button
              onClick={() => navigate('/home')}
              className="w-full bg-night-800 hover:bg-night-700 text-parchment-200 font-crimson py-2 rounded-lg transition-colors border border-night-600"
            >
              Retour à l'accueil
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
