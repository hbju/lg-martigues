import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../stores/gameStore'
import { useAuthStore } from '../../stores/authStore'
import { motion } from 'framer-motion'
import type { Player, Elimination, VoteRound, Vote, PowerUp } from '../../types/supabase'
import { GiWolfHead, GiVillage, GiVote, GiDeathSkull, GiCoffin, GiCrystalBall, GiCheckedShield, GiScrollUnfurled } from 'react-icons/gi'

interface RecapEvent {
  type: 'vote' | 'murder' | 'infection' | 'powerup' | 'challenge'
  timestamp: string
  title: string
  description: string
  icon: ReactNode
}

export function RecapPage() {
  const { gameState, fetchGameState } = useGameStore()
  const { player } = useAuthStore()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [events, setEvents] = useState<RecapEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchGameState()
    loadRecap()
  }, [])

  async function loadRecap() {
    setIsLoading(true)

    const [pRes, eRes, rRes, vRes, puRes] = await Promise.all([
      supabase.from('players').select('*').eq('is_gm', false).order('name'),
      supabase.from('eliminations').select('*').eq('confirmed_by_gm', true).order('created_at'),
      supabase.from('vote_rounds').select('*').eq('status', 'resolved').order('created_at'),
      supabase.from('votes').select('*').order('created_at'),
      supabase.from('power_ups').select('*').eq('used', true).order('used_at'),
    ])

    const allPlayers = (pRes.data ?? []) as Player[]
    const eliminations = (eRes.data ?? []) as Elimination[]
    const rounds = (rRes.data ?? []) as VoteRound[]
    const votes = (vRes.data ?? []) as Vote[]
    const powerUps = (puRes.data ?? []) as PowerUp[]

    setPlayers(allPlayers)

    const getName = (id: string) => allPlayers.find(p => p.id === id)?.name ?? 'Inconnu'

    const timeline: RecapEvent[] = []

    // Process each vote round
    for (const round of rounds) {
      const roundVotes = votes.filter(v => v.round_id === round.id)
      const elim = eliminations.find(e => e.round_id === round.id)

      if (round.type === 'council' || round.type === 'final') {
        // Tally
        const tally: Record<string, string[]> = {}
        roundVotes.forEach(v => {
          if (!tally[v.target_id]) tally[v.target_id] = []
          tally[v.target_id].push(getName(v.voter_id))
        })

        const tallyStr = Object.entries(tally)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([tid, voters]) => `${getName(tid)}: ${voters.length} (${voters.join(', ')})`)
          .join(' | ')

        timeline.push({
          type: 'vote',
          timestamp: round.created_at,
          title: round.type === 'final' ? 'Vote Final' : 'Conseil du Village',
          description: `${tallyStr}${elim ? ` → ${getName(elim.player_id)} éliminé(e)` : ''}`,
          icon: <GiVote />,
        })
      } else if (round.type === 'murder') {
        timeline.push({
          type: 'murder',
          timestamp: round.created_at,
          title: 'Attaque nocturne',
          description: elim
            ? `Les loups ont tué ${getName(elim.player_id)}`
            : 'Les loups n\'ont pas réussi à se mettre d\'accord',
          icon: <GiWolfHead />,
        })
      }
    }

    // Process standalone eliminations (murders not tied to rounds)
    for (const elim of eliminations) {
      if (elim.round_id) continue // Already handled above
      const p = allPlayers.find(pp => pp.id === elim.player_id)
      if (p) {
        timeline.push({
          type: 'murder',
          timestamp: elim.created_at,
          title: elim.method === 'murdered' ? 'Meurtre' : 'Élimination',
          description: `${p.name} a été éliminé(e) (${elim.method})`,
          icon: elim.method === 'murdered' ? <GiDeathSkull /> : <GiCoffin />,
        })
      }
    }

    // Process power-up usage
    for (const pu of powerUps) {
      timeline.push({
        type: 'powerup',
        timestamp: pu.used_at ?? pu.created_at,
        title: pu.type === 'clairvoyance' ? 'Clairvoyance utilisée' : 'Bouclier activé',
        description: pu.type === 'clairvoyance'
          ? `${getName(pu.player_id)} a regardé le rôle de ${pu.used_on ? getName(pu.used_on) : '???'}`
          : `${getName(pu.player_id)} a été protégé par un bouclier`,
        icon: pu.type === 'clairvoyance' ? <GiCrystalBall /> : <GiCheckedShield />,
      })
    }

    // Sort chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    setEvents(timeline)
    setIsLoading(false)
  }

  if (!player) return null

  const metadata = (gameState?.metadata ?? {}) as Record<string, unknown>
  const winner = metadata.winner as string | undefined
  const survivors = players.filter(p => p.status === 'alive')
  const ghosts = players.filter(p => p.status === 'ghost')

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-2 inline-flex items-center gap-2">
            <GiScrollUnfurled /> Récapitulatif de la Partie
          </h1>
          {winner && (
            <p className={`font-crimson text-lg italic mb-6 ${winner === 'werewolves' ? 'text-red-400' : 'text-candle-400'
              }`}>
              {winner === 'werewolves' ? <><GiWolfHead className="inline" /> Victoire des Loups-Garous</> : <><GiVillage className="inline" /> Victoire des Villageois</>}
            </p>
          )}
        </motion.div>

        {/* Survivors & Ghosts */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-parchment-card rounded-xl p-4 backdrop-blur-sm">
            <h3 className="font-cinzel text-candle-400 text-sm font-semibold mb-3 tracking-wider uppercase">
              Survivants ({survivors.length})
            </h3>
            <div className="space-y-1">
              {survivors.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <span>{p.role === 'werewolf' ? <GiWolfHead /> : <GiVillage />}</span>
                  <span className="font-crimson text-parchment-200 text-sm">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-parchment-card rounded-xl p-4 backdrop-blur-sm">
            <h3 className="font-cinzel text-moon-400/60 text-sm font-semibold mb-3 tracking-wider uppercase">
              Éliminés ({ghosts.length})
            </h3>
            <div className="space-y-1">
              {ghosts.map(p => (
                <div key={p.id} className="flex items-center gap-2 opacity-60">
                  <span>{p.role === 'werewolf' ? <GiWolfHead /> : <GiVillage />}</span>
                  <span className="font-crimson text-moon-400 text-sm">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <h2 className="font-cinzel text-parchment-100 font-semibold mb-4 text-sm tracking-wider uppercase">
          Chronologie des événements
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-night-800/50 rounded-xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {events.map((event, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-parchment-card rounded-xl p-4 backdrop-blur-sm border-l-4 ${event.type === 'murder' ? 'border-l-red-500/60' :
                  event.type === 'vote' ? 'border-l-candle-500/60' :
                    event.type === 'powerup' ? 'border-l-purple-500/60' :
                      'border-l-green-500/60'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{event.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-cinzel text-parchment-100 text-sm font-semibold">
                      {event.title}
                    </p>
                    <p className="font-crimson text-moon-400 text-sm mt-1">
                      {event.description}
                    </p>
                    <p className="font-crimson text-moon-400/40 text-xs mt-1">
                      {new Date(event.timestamp).toLocaleString('fr-FR', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/home')}
          className="w-full bg-night-800 hover:bg-night-700 text-parchment-200 font-crimson py-3 rounded-lg transition-colors border border-night-600"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  )
}
