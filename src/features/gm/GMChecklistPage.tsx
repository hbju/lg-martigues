import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import type { Challenge, QrCode } from '../../types/supabase'
import { RiCheckboxCircleFill, RiCheckboxBlankLine } from 'react-icons/ri'

interface ChecklistItem {
  label: string
  checked: boolean
  link?: string
}

export function GMChecklistPage() {
  const { players } = useRealtimePlayers()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [qrCodes, setQrCodes] = useState<QrCode[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [cRes, qRes] = await Promise.all([
      supabase.from('challenges').select('*'),
      supabase.from('qr_codes').select('*'),
    ])
    if (cRes.data) setChallenges(cRes.data as Challenge[])
    if (qRes.data) setQrCodes(qRes.data as QrCode[])
  }

  const nonGmPlayers = players.filter(p => !p.is_gm)
  const beerPong = challenges.find(c => c.type === 'beer_pong')
  const madScientists = challenges.find(c => c.type === 'mad_scientists')

  // Determine werewolf meeting point from game_state metadata
  const [hasMeetingPoint, setHasMeetingPoint] = useState(false)
  useEffect(() => {
    supabase.from('game_state').select('metadata').eq('id', 1).single().then(({ data }) => {
      const meta = (data?.metadata ?? {}) as Record<string, unknown>
      setHasMeetingPoint(!!meta.meeting_point)
    })
  }, [])

  const items: ChecklistItem[] = [
    {
      label: `17 comptes joueurs créés (${nonGmPlayers.length}/17)`,
      checked: nonGmPlayers.length >= 17,
      link: '/gm/qr-codes',
    },
    {
      label: 'QR codes de connexion imprimés et découpés',
      checked: false, // Manual check
      link: '/gm/qr-codes',
    },
    {
      label: `QR codes récompenses créés (${qrCodes.length})`,
      checked: qrCodes.length > 0,
      link: '/gm/reward-qr',
    },
    {
      label: 'QR codes récompenses imprimés et cachés',
      checked: false, // Manual check
    },
    {
      label: 'Challenge Beer Pong créé',
      checked: !!beerPong,
      link: '/gm/challenges/beer-pong',
    },
    {
      label: 'Challenge Savants Fous créé',
      checked: !!madScientists,
      link: '/gm/challenges/mad-scientists',
    },
    {
      label: 'Point de rendez-vous des loups défini',
      checked: hasMeetingPoint,
      link: '/gm',
    },
    {
      label: 'TV testée sur l\'écran du salon',
      checked: false, // Manual check
      link: '/tv',
    },
  ]

  const completedCount = items.filter(i => i.checked).length

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">
            <RiCheckboxCircleFill className="inline" /> Checklist Pré-Événement
          </h1>
          <Link
            to="/gm"
            className="text-moon-400 hover:text-parchment-200 font-crimson text-sm transition-colors"
          >
            ← Retour
          </Link>
        </div>

        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-crimson text-moon-400 text-sm">Progression</p>
            <p className="font-cinzel text-candle-400 font-semibold">
              {completedCount}/{items.length}
            </p>
          </div>
          <div className="h-3 bg-night-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-candle-500 to-candle-400 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / items.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`bg-parchment-card rounded-xl p-4 backdrop-blur-sm flex items-center gap-4 border-l-4 ${item.checked ? 'border-l-green-500/60' : 'border-l-moon-400/20'
                }`}
            >
              <span className="text-xl flex-shrink-0">
                {item.checked ? <RiCheckboxCircleFill /> : <RiCheckboxBlankLine />}
              </span>
              <div className="flex-1">
                <p className={`font-crimson ${item.checked ? 'text-parchment-200 line-through opacity-60' : 'text-parchment-100'
                  }`}>
                  {item.label}
                </p>
              </div>
              {item.link && (
                <Link
                  to={item.link}
                  className="text-candle-400 hover:text-candle-300 text-sm font-crimson flex-shrink-0"
                >
                  Voir →
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 bg-night-800/50 border border-night-700/30 rounded-xl p-4">
          <p className="font-crimson text-moon-400/60 text-sm italic text-center">
            Les éléments cochés sont vérifiés automatiquement.
            Les éléments physiques (impression, TV) doivent être confirmés manuellement.
          </p>
        </div>
      </div>
    </div>
  )
}
